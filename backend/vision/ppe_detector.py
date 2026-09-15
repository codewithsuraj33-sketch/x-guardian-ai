"""CUDA-only Ultralytics PPE detector with tracking and temporal safety rules."""

from __future__ import annotations

import base64
import os
import time
import binascii
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from app.models.schemas import (
    BoundingBoxSchema,
    DetectionItemSchema,
    PersonSafetySchema,
    VisionFrameResponse,
    VisionIncidentSchema,
)
from .detector import VisionDetector

REQUIRED_PPE = ("Helmet", "Vest", "Boots", "Glove", "Mask")
PPE_NAMES = set(REQUIRED_PPE)
DETECTION_THRESHOLD = 0.45
VEST_CONFIDENCE_THRESHOLD = float(os.getenv("XGUARDIAN_VEST_CONFIDENCE_THRESHOLD", "0.60"))
KEEP_CONFIRMED_THRESHOLD = 0.40
TEMPORAL_WINDOW = 5
PERSISTENCE_RATIO = 0.60
VIOLATION_CONFIRMATION_FRAMES = 15
RECOVERY_FRAMES = 5
MIN_VISIBLE_FRACTION = 0.50
MIN_PERSON_AREA_FRACTION = 0.0005


class UnavailablePPEDetector:
    def __init__(self, reason: str):
        self.reason = reason

    def is_ready(self) -> bool:
        return False

    def detect(self, image_bytes: bytes, camera_id: str, source: str = "image") -> VisionFrameResponse:
        raise RuntimeError(self.reason)


@dataclass
class PPEState:
    history: list[bool] = field(default_factory=list)
    confirmed: bool = False
    state: str = "UNKNOWN"
    observed_frames: int = 0
    missing_frames: int = 0
    recovery_frames: int = 0
    confidence: float | None = None


@dataclass
class TrackState:
    ppe: dict[str, PPEState] = field(default_factory=lambda: {name: PPEState() for name in REQUIRED_PPE})


def box_center(box: list[float]) -> tuple[float, float]:
    return (box[0] + box[2]) / 2, (box[1] + box[3]) / 2


def ppe_region(name: str, person: list[float]) -> tuple[float, float, float, float]:
    left, top, right, bottom = person
    width = right - left
    height = bottom - top
    if name == "Helmet":
        return left - width * 0.10, top - height * 0.10, right + width * 0.10, top + height * 0.35
    if name == "Mask":
        return left - width * 0.05, top + height * 0.08, right + width * 0.05, top + height * 0.35
    if name == "Vest":
        return left + width * 0.10, top + height * 0.20, right - width * 0.10, top + height * 0.78
    if name == "Glove":
        return left - width * 0.15, top + height * 0.30, right + width * 0.15, top + height * 0.85
    return left - width * 0.15, top + height * 0.68, right + width * 0.15, bottom + height * 0.10


def overlaps_or_contains_center(box: list[float], region: tuple[float, float, float, float]) -> bool:
    left, top, right, bottom = box
    region_left, region_top, region_right, region_bottom = region
    center_x, center_y = box_center(box)
    center_inside = region_left <= center_x <= region_right and region_top <= center_y <= region_bottom
    overlap_width = max(0.0, min(right, region_right) - max(left, region_left))
    overlap_height = max(0.0, min(bottom, region_bottom) - max(top, region_top))
    return center_inside or (overlap_width > 0 and overlap_height > 0)


def visible_person(box: list[float], width: int, height: int) -> bool:
    left, top, right, bottom = box
    box_width = max(0.0, right - left)
    box_height = max(0.0, bottom - top)
    area_fraction = box_width * box_height / max(width * height, 1)
    clipped_width = max(0.0, min(right, width) - max(left, 0.0))
    clipped_height = max(0.0, min(bottom, height) - max(top, 0.0))
    visible_fraction = clipped_width * clipped_height / max(box_width * box_height, 1.0)
    return visible_fraction >= MIN_VISIBLE_FRACTION and area_fraction >= MIN_PERSON_AREA_FRACTION


def update_ppe_state(item: PPEState, name: str, is_associated: bool, confidence: float | None) -> str:
    item.observed_frames += 1
    if is_associated and confidence is not None:
        item.confidence = confidence
    class_threshold = VEST_CONFIDENCE_THRESHOLD if name == "Vest" else DETECTION_THRESHOLD
    threshold = class_threshold if item.confirmed or item.state in {"VIOLATION", "COMPLIANT"} else class_threshold
    eligible = is_associated and confidence is not None and confidence >= threshold
    item.history.append(eligible)
    item.history = item.history[-TEMPORAL_WINDOW:]
    persistence = sum(item.history) / len(item.history)

    if item.state == "VIOLATION":
        item.recovery_frames = item.recovery_frames + 1 if eligible else 0
        if item.recovery_frames >= RECOVERY_FRAMES:
            item.confirmed = True
            item.state = "COMPLIANT"
            item.missing_frames = 0
        return item.state
    if item.state == "COMPLIANT":
        if eligible:
            return item.state
        item.state = "MISSING_CANDIDATE"
        item.missing_frames = 1
        return item.state

    if len(item.history) >= TEMPORAL_WINDOW and persistence >= PERSISTENCE_RATIO:
        item.confirmed = True
        item.state = "CONFIRMED"
        item.missing_frames = 0
    elif eligible:
        item.state = "DETECTED"
        item.missing_frames = 0
    else:
        item.state = "UNKNOWN" if item.observed_frames < TEMPORAL_WINDOW else "MISSING_CANDIDATE"
        if item.state == "MISSING_CANDIDATE":
            item.missing_frames += 1
    return item.state


class UltralyticsPPEDetector:
    def __init__(self, model_path: str):
        self.model_path = Path(model_path)
        self.model: Any = None
        self.device = "cpu"
        self.load_error: str | None = None
        self._tracks: dict[str, dict[int, TrackState]] = {}
        self._active_incidents: set[tuple[str, int, str]] = set()
        self._frame_numbers: dict[str, int] = {}
        try:
            import torch
            from ultralytics import YOLO

            self.device = "cuda:0" if torch.cuda.is_available() else "cpu"
            self.model = YOLO(str(self.model_path))
        except Exception as error:
            self.load_error = str(error)

    def is_ready(self) -> bool:
        return self.model is not None and self.model_path.is_file() and self.load_error is None

    def reset_session(self, camera_id: str) -> None:
        self._tracks.pop(camera_id, None)
        self._frame_numbers.pop(camera_id, None)
        self._active_incidents = {key for key in self._active_incidents if key[0] != camera_id}

    def detect(self, image_bytes: bytes, camera_id: str, source: str = "image") -> VisionFrameResponse:
        if not self.is_ready():
            raise RuntimeError(self.load_error or "PPE model checkpoint is not available")
        started = time.perf_counter()
        # Browser clients normally send binary image bytes, but normalize data-URL
        # payloads as well so mobile uploads and canvas fallbacks decode consistently.
        payload = image_bytes.strip()
        if payload.startswith(b"data:"):
            try:
                payload = base64.b64decode(payload.split(b",", 1)[1], validate=True)
            except (ValueError, binascii.Error, IndexError) as error:
                raise RuntimeError("The uploaded frame contains an invalid data URL") from error
        image = cv2.imdecode(np.frombuffer(payload, dtype=np.uint8), cv2.IMREAD_COLOR)
        if image is None:
            raise RuntimeError("Could not decode the uploaded frame as an image")
        height, width = image.shape[:2]
        frame_number = self._frame_numbers.get(camera_id, 0) + 1
        self._frame_numbers[camera_id] = frame_number
        tracks = self._tracks.setdefault(camera_id, {})
        result = self.model.track(source=image, device=self.device, tracker="bytetrack.yaml", conf=KEEP_CONFIRMED_THRESHOLD, persist=True, verbose=False)[0]
        ids = result.boxes.id
        persons: dict[int, list[float]] = {}
        ppe_detections: list[tuple[str, float, list[float]]] = []
        detections: list[DetectionItemSchema] = []
        timestamp = datetime.now(timezone.utc).isoformat()

        for index, box in enumerate(result.boxes):
            class_index = int(box.cls.item())
            class_name = str(result.names.get(class_index, class_index))
            confidence = float(box.conf.item())
            coordinates = [float(value) for value in box.xyxy[0].tolist()]
            track_id = int(ids[index].item()) if ids is not None else None
            detections.append(DetectionItemSchema(detectionId=f"det-{camera_id}-{frame_number}-{index}", className=class_name.lower().replace("-", "_"), confidence=confidence, boundingBox=BoundingBoxSchema(x=coordinates[0] / width, y=coordinates[1] / height, width=(coordinates[2] - coordinates[0]) / width, height=(coordinates[3] - coordinates[1]) / height), trackId=str(track_id) if track_id is not None else None, timestamp=timestamp, source=source))
            if class_name == "Person" and track_id is not None:
                persons[track_id] = coordinates
            elif class_name in PPE_NAMES:
                ppe_detections.append((class_name, confidence, coordinates))

        associated_by_track: dict[int, dict[str, tuple[float, list[float]]]] = {}
        for name, confidence, coordinates in ppe_detections:
            candidates = [track_id for track_id, person in persons.items() if overlaps_or_contains_center(coordinates, ppe_region(name, person))]
            if candidates:
                track_id = min(candidates, key=lambda candidate: ((box_center(coordinates)[0] - box_center(persons[candidate])[0]) ** 2 + (box_center(coordinates)[1] - box_center(persons[candidate])[1]) ** 2))
                current = associated_by_track.setdefault(track_id, {}).get(name)
                if current is None or confidence > current[0]:
                    associated_by_track[track_id][name] = (confidence, coordinates)

        incidents: list[VisionIncidentSchema] = []
        person_summaries: list[PersonSafetySchema] = []
        annotated = result.plot()
        for track_id, person_box in persons.items():
            state_track = tracks.setdefault(track_id, TrackState())
            visible = visible_person(person_box, width, height)
            ppe_states: dict[str, str] = {}
            violation_types: list[str] = []
            for name in REQUIRED_PPE:
                item = state_track.ppe[name]
                association = associated_by_track.get(track_id, {}).get(name)
                state = update_ppe_state(item, name, bool(association) if visible else False, association[0] if association else None)
                key = (camera_id, track_id, name)
                if state == "MISSING_CANDIDATE" and visible:
                    if item.missing_frames >= VIOLATION_CONFIRMATION_FRAMES:
                        state = "VIOLATION"
                        item.state = state
                if state == "VIOLATION":
                    violation_types.append(f"Missing {name}")
                    if key not in self._active_incidents:
                        incident_id = f"INC-AI-{camera_id}-{frame_number}-{track_id}-{name}"
                        evidence_frame = annotated.copy()
                        x1, y1, x2, y2 = [int(value) for value in person_box]
                        cv2.rectangle(evidence_frame, (x1, y1), (x2, y2), (0, 0, 255), 3)
                        cv2.putText(evidence_frame, f"ID {track_id} PPE VIOLATION", (x1, max(24, y1 - 34)), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
                        cv2.putText(evidence_frame, f"Missing: {name}", (x1, max(24, y1 - 10)), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 0, 255), 2)
                        state_text = " | ".join(f"{ppe}: {'OK' if state_track.ppe[ppe].state in {'CONFIRMED', 'COMPLIANT'} else state_track.ppe[ppe].state}" for ppe in REQUIRED_PPE)
                        cv2.putText(evidence_frame, state_text, (x1, min(height - 10, y2 + 24)), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 220, 0), 2)
                        cv2.putText(evidence_frame, timestamp, (12, height - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
                        encoded_ok, encoded = cv2.imencode(".jpg", evidence_frame)
                        evidence = f"data:image/jpeg;base64,{base64.b64encode(encoded.tobytes()).decode('ascii')}" if encoded_ok else None
                        incidents.append(VisionIncidentSchema(incidentId=incident_id, trackId=str(track_id), violationType=f"Missing {name}", requiredPpe=name, timestamp=timestamp, frameNumber=frame_number, confidence=item.confidence, cameraId=camera_id, zone="TEST-ZONE", evidenceImage=evidence))
                        self._active_incidents.add(key)
                elif key in self._active_incidents and state == "COMPLIANT":
                    self._active_incidents.remove(key)
                ppe_states[name] = state
            person_summaries.append(PersonSafetySchema(trackId=str(track_id), boundingBox=BoundingBoxSchema(x=person_box[0] / width, y=person_box[1] / height, width=(person_box[2] - person_box[0]) / width, height=(person_box[3] - person_box[1]) / height), visible=visible, ppeStates=ppe_states, violationTypes=violation_types))

        elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
        return VisionFrameResponse(timestamp=timestamp, cameraId=camera_id, source=source, detections=detections, persons=person_summaries, incidents=incidents, inferenceTimeMs=elapsed_ms)


def create_ppe_detector() -> VisionDetector:
    project_root = Path(__file__).resolve().parents[2]
    model_path = os.getenv("XGUARDIAN_PPE_MODEL_PATH", str(project_root / "models" / "best.pt")).strip()
    if not Path(model_path).is_file():
        return UnavailablePPEDetector(f"PPE model checkpoint not found: {model_path}")
    return UltralyticsPPEDetector(model_path)