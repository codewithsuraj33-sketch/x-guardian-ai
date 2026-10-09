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
    FireSmokeSchema,
    PersonSafetySchema,
    PPESummarySchema,
    SkeletonPoseSchema,
    VisionFrameResponse,
    VisionIncidentSchema,
)
from .detector import VisionDetector
from .hazard_detector import IndustrialHazardDetector
from .pose_detector import SkeletonPoseTracker

REQUIRED_PPE = ("Helmet", "Vest", "Boots", "Glove", "Mask", "Glass")
PPE_NAMES = set(REQUIRED_PPE)
DETECTION_THRESHOLD = 0.28
VEST_CONFIDENCE_THRESHOLD = float(os.getenv("XGUARDIAN_VEST_CONFIDENCE_THRESHOLD", "0.52"))
GLASS_DETECTION_THRESHOLD = float(os.getenv("XGUARDIAN_GLASS_CONFIDENCE_THRESHOLD", "0.16"))
KEEP_CONFIRMED_THRESHOLD = 0.16
TEMPORAL_WINDOW = 3
PERSISTENCE_RATIO = 0.35
VIOLATION_CONFIRMATION_FRAMES = int(os.getenv("XGUARDIAN_CONFIRMATION_FRAMES", "2"))
RECOVERY_FRAMES = 3
MIN_VISIBLE_FRACTION = 0.40
MIN_PERSON_AREA_FRACTION = 0.0005


def is_valid_safety_vest(crop_bgr: np.ndarray | None, confidence: float) -> bool:
    """
    Validates whether a detected 'Vest' region is a genuine industrial high-vis safety vest
    or just a regular casual t-shirt / shirt.
    - If model confidence is high (>= 0.70), accept.
    - Otherwise, inspect color in HSV space for fluorescent yellow/lime or safety orange.
    - Plain casual t-shirts (black, grey, blue, maroon, white) without high-vis color are rejected.
    """
    if confidence >= 0.70:
        return True
    if crop_bgr is None or crop_bgr.size == 0 or crop_bgr.shape[0] < 10 or crop_bgr.shape[1] < 10:
        return False

    try:
        hsv = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2HSV)
        # Fluorescent high-vis neon yellow / lime green
        mask_yellow = cv2.inRange(hsv, np.array([20, 50, 70]), np.array([65, 255, 255]))
        # Fluorescent high-vis safety orange / bright reddish-orange
        mask_orange = cv2.inRange(hsv, np.array([4, 75, 75]), np.array([22, 255, 255]))
        # High-reflectivity retroreflective stripes
        mask_refl = cv2.inRange(hsv, np.array([0, 0, 180]), np.array([180, 40, 255]))

        combined = mask_yellow | mask_orange | mask_refl
        hivis_ratio = float(cv2.countNonZero(combined)) / float(crop_bgr.shape[0] * crop_bgr.shape[1])
        return hivis_ratio >= 0.08 or confidence >= 0.65
    except Exception:
        return confidence >= 0.55


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
    if name == "Glass":
        return left - width * 0.12, top - height * 0.05, right + width * 0.12, top + height * 0.38
    if name == "Mask":
        return left - width * 0.05, top + height * 0.08, right + width * 0.05, top + height * 0.35
    if name == "Vest":
        return left + width * 0.08, top + height * 0.18, right - width * 0.08, top + height * 0.80
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
    if name == "Vest":
        class_threshold = VEST_CONFIDENCE_THRESHOLD
    elif name == "Glass":
        class_threshold = GLASS_DETECTION_THRESHOLD
    else:
        class_threshold = DETECTION_THRESHOLD

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

        pose_model_path = os.getenv("XGUARDIAN_POSE_MODEL_PATH", str(self.model_path.parent / "yolov8n-pose.pt")).strip()
        self.pose_tracker: SkeletonPoseTracker | None = SkeletonPoseTracker(pose_model_path) if Path(pose_model_path).is_file() else None
        self.hazard_detector = IndustrialHazardDetector()

    def is_ready(self) -> bool:
        return self.model is not None and self.model_path.is_file() and self.load_error is None

    def reset_session(self, camera_id: str) -> None:
        self._tracks.pop(camera_id, None)
        self._frame_numbers.pop(camera_id, None)
        self._active_incidents = {key for key in self._active_incidents if key[0] != camera_id}
        if self.pose_tracker:
            self.pose_tracker.reset_session(camera_id)

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
            effective_id = track_id if track_id is not None else (index + 1)

            # Validate genuine industrial safety vest vs casual t-shirt / shirt
            if class_name == "Vest":
                vx1, vy1, vx2, vy2 = [max(0, int(v)) for v in coordinates]
                vx2, vy2 = min(width, vx2), min(height, vy2)
                crop = image[vy1:vy2, vx1:vx2] if (vy2 > vy1 and vx2 > vx1) else None
                if not is_valid_safety_vest(crop, confidence):
                    continue  # Suppress false-positive casual clothing

            detections.append(
                DetectionItemSchema(
                    detectionId=f"det-{camera_id}-{frame_number}-{index}",
                    className=class_name.lower().replace("-", "_"),
                    confidence=confidence,
                    boundingBox=BoundingBoxSchema(
                        x=coordinates[0] / width,
                        y=coordinates[1] / height,
                        width=(coordinates[2] - coordinates[0]) / width,
                        height=(coordinates[3] - coordinates[1]) / height,
                    ),
                    trackId=str(effective_id),
                    timestamp=timestamp,
                    source=source,
                )
            )
            if class_name == "Person":
                persons[effective_id] = coordinates
            elif class_name in PPE_NAMES:
                ppe_detections.append((class_name, confidence, coordinates))

        # Multi-spectral optical fire & smoke hazard analysis (with worker vest masking)
        excluded_boxes = list(persons.values()) + [coords for (pname, _, coords) in ppe_detections if pname in ("Vest", "Helmet")]
        hazard_res = self.hazard_detector.detect(image, person_boxes=excluded_boxes)

        if hazard_res.fire.has_fire and hazard_res.fire.bbox:
            fx, fy, fw, fh = hazard_res.fire.bbox
            detections.append(
                DetectionItemSchema(
                    detectionId=f"det-{camera_id}-{frame_number}-fire",
                    className="fire",
                    confidence=hazard_res.fire.confidence,
                    boundingBox=BoundingBoxSchema(x=fx, y=fy, width=fw, height=fh),
                    trackId=None,
                    timestamp=timestamp,
                    source=source,
                )
            )

        if hazard_res.smoke.has_smoke and hazard_res.smoke.bbox:
            sx, sy, sw, sh = hazard_res.smoke.bbox
            detections.append(
                DetectionItemSchema(
                    detectionId=f"det-{camera_id}-{frame_number}-smoke",
                    className="smoke",
                    confidence=hazard_res.smoke.confidence,
                    boundingBox=BoundingBoxSchema(x=sx, y=sy, width=sw, height=sh),
                    trackId=None,
                    timestamp=timestamp,
                    source=source,
                )
            )

        skeletons_by_track: dict[int, SkeletonPoseSchema] = {}
        all_skeletons: list[SkeletonPoseSchema] = []
        if self.pose_tracker and self.pose_tracker.is_ready():
            pose_res = self.pose_tracker.extract_poses(image, camera_id, persons)
            skeletons_by_track = pose_res.poses_by_track
            all_skeletons = pose_res.all_skeletons

            # Dual-model synergy: if YOLOv8-pose detected persons missed by best.pt, incorporate them
            for supp_tid, supp_box, supp_conf in pose_res.supplementary_persons:
                if supp_tid not in persons:
                    persons[supp_tid] = supp_box
                    detections.append(
                        DetectionItemSchema(
                            detectionId=f"det-{camera_id}-{frame_number}-pose-{supp_tid}",
                            className="person",
                            confidence=round(supp_conf, 3),
                            boundingBox=BoundingBoxSchema(
                                x=round(supp_box[0] / width, 4),
                                y=round(supp_box[1] / height, 4),
                                width=round((supp_box[2] - supp_box[0]) / width, 4),
                                height=round((supp_box[3] - supp_box[1]) / height, 4),
                            ),
                            trackId=str(supp_tid),
                            timestamp=timestamp,
                            source=source,
                        )
                    )

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

        cam_zone_map = {
            "CAM-01": "ZONE-01",
            "CAM-02": "ZONE-02",
            "CAM-03": "ZONE-03",
            "CAM-04": "ZONE-04",
            "CAM-05": "ZONE-05",
        }
        cam_zone = cam_zone_map.get(camera_id, "ZONE-01")

        # Multi-spectral optical fire hazard alerts & evidence
        fire_key = (camera_id, "HAZARD", "FIRE")
        if hazard_res.fire.has_fire and hazard_res.fire.bbox:
            fx, fy, fw, fh = hazard_res.fire.bbox
            bx1, by1, bx2, by2 = int(fx * width), int(fy * height), int((fx + fw) * width), int((fy + fh) * height)
            cv2.rectangle(annotated, (bx1, by1), (bx2, by2), (0, 69, 255), 4)
            cv2.putText(annotated, f"FIRE HAZARD ({int(hazard_res.fire.confidence * 100)}%)", (bx1, max(24, by1 - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 0, 255), 2)
            if fire_key not in self._active_incidents:
                incident_id = f"INC-AI-{camera_id}-{frame_number}-FIRE"
                evidence_frame = annotated.copy()
                cv2.putText(evidence_frame, "CRITICAL: FIRE HAZARD DETECTED", (20, 45), cv2.FONT_HERSHEY_SIMPLEX, 0.95, (0, 0, 255), 3)
                cv2.putText(evidence_frame, timestamp, (12, height - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
                encoded_ok, encoded = cv2.imencode(".jpg", evidence_frame)
                evidence = f"data:image/jpeg;base64,{base64.b64encode(encoded.tobytes()).decode('ascii')}" if encoded_ok else None
                incidents.append(
                    VisionIncidentSchema(
                        incidentId=incident_id,
                        trackId="HAZARD",
                        violationType="Fire Hazard Detected",
                        requiredPpe="Emergency Evacuation / Fire Extinguisher",
                        timestamp=timestamp,
                        frameNumber=frame_number,
                        confidence=hazard_res.fire.confidence,
                        cameraId=camera_id,
                        zone="HAZARD-ZONE",
                        evidenceImage=evidence,
                    )
                )
                self._active_incidents.add(fire_key)
        else:
            self._active_incidents.discard(fire_key)

        smoke_key = (camera_id, "HAZARD", "SMOKE")
        if hazard_res.smoke.has_smoke and hazard_res.smoke.bbox and hazard_res.smoke.density > 20.0:
            sx, sy, sw, sh = hazard_res.smoke.bbox
            bx1, by1, bx2, by2 = int(sx * width), int(sy * height), int((sx + sw) * width), int((sy + sh) * height)
            cv2.rectangle(annotated, (bx1, by1), (bx2, by2), (180, 180, 180), 3)
            cv2.putText(annotated, f"SMOKE ({hazard_res.smoke.density:.0f}%)", (bx1, max(24, by1 - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 200, 200), 2)
            if smoke_key not in self._active_incidents:
                incident_id = f"INC-AI-{camera_id}-{frame_number}-SMOKE"
                evidence_frame = annotated.copy()
                cv2.putText(evidence_frame, f"WARNING: SMOKE HAZARD ({hazard_res.smoke.density:.0f}%)", (20, 45), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 165, 255), 2)
                cv2.putText(evidence_frame, timestamp, (12, height - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
                encoded_ok, encoded = cv2.imencode(".jpg", evidence_frame)
                evidence = f"data:image/jpeg;base64,{base64.b64encode(encoded.tobytes()).decode('ascii')}" if encoded_ok else None
                incidents.append(
                    VisionIncidentSchema(
                        incidentId=incident_id,
                        trackId="HAZARD",
                        violationType="Smoke / Toxic Haze Detected",
                        requiredPpe="Emergency Ventilation / Breathing Mask",
                        timestamp=timestamp,
                        frameNumber=frame_number,
                        confidence=hazard_res.smoke.confidence,
                        cameraId=camera_id,
                        zone="HAZARD-ZONE",
                        evidenceImage=evidence,
                    )
                )
                self._active_incidents.add(smoke_key)
        else:
            self._active_incidents.discard(smoke_key)

        for track_id, person_box in persons.items():
            state_track = tracks.setdefault(track_id, TrackState())
            visible = visible_person(person_box, width, height)
            ppe_states: dict[str, str] = {}
            violation_types: list[str] = []

            # Skeleton posture & fall incident evaluation
            skeleton = skeletons_by_track.get(track_id)
            if skeleton:
                fall_key = (camera_id, track_id, "FALL")
                if skeleton.isFall:
                    violation_types.append("Worker Fall / Collapse")
                    if fall_key not in self._active_incidents:
                        incident_id = f"INC-AI-{camera_id}-{frame_number}-{track_id}-FALL"
                        evidence_frame = annotated.copy()
                        x1, y1, x2, y2 = [int(value) for value in person_box]
                        cv2.rectangle(evidence_frame, (x1, y1), (x2, y2), (0, 0, 255), 4)
                        cv2.putText(evidence_frame, f"CRITICAL: WORKER FALL / COLLAPSE (ID {track_id})", (x1, max(28, y1 - 20)), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 0, 255), 2)
                        angle_label = f"Torso Angle: {skeleton.torsoAngle} deg | Man Down" if skeleton.torsoAngle is not None else "Man Down"
                        cv2.putText(evidence_frame, angle_label, (x1, max(28, y1 + 5)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
                        cv2.putText(evidence_frame, timestamp, (12, height - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
                        encoded_ok, encoded = cv2.imencode(".jpg", evidence_frame)
                        evidence = f"data:image/jpeg;base64,{base64.b64encode(encoded.tobytes()).decode('ascii')}" if encoded_ok else None
                        incidents.append(VisionIncidentSchema(incidentId=incident_id, trackId=str(track_id), violationType="Worker Fall / Collapse", requiredPpe="Emergency Assistance", timestamp=timestamp, frameNumber=frame_number, confidence=0.98, cameraId=camera_id, zone=cam_zone, evidenceImage=evidence))
                        self._active_incidents.add(fall_key)
                elif fall_key in self._active_incidents and skeleton.postureState == "STANDING":
                    self._active_incidents.remove(fall_key)
                elif skeleton.isAbnormalPosture:
                    violation_types.append("Unsafe Posture / Ergonomic Strain")

            for name in REQUIRED_PPE:
                item = state_track.ppe[name]
                association = associated_by_track.get(track_id, {}).get(name)
                state = update_ppe_state(item, name, bool(association) if visible else False, association[0] if association else None)
                key = (camera_id, track_id, name)
                display_ppe = "Safety Goggles" if name == "Glass" else name
                if state == "MISSING_CANDIDATE" and visible:
                    req_frames = 1 if source in ("image", "upload", "photo") else VIOLATION_CONFIRMATION_FRAMES
                    if item.missing_frames >= req_frames:
                        state = "VIOLATION"
                        item.state = state
                if state == "VIOLATION":
                    violation_types.append(f"Missing {display_ppe}")
                    if key not in self._active_incidents:
                        incident_id = f"INC-AI-{camera_id}-{frame_number}-{track_id}-{name}"
                        evidence_frame = annotated.copy()
                        x1, y1, x2, y2 = [int(value) for value in person_box]
                        cv2.rectangle(evidence_frame, (x1, y1), (x2, y2), (0, 0, 255), 3)
                        cv2.putText(evidence_frame, f"ID {track_id} PPE VIOLATION", (x1, max(24, y1 - 34)), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
                        cv2.putText(evidence_frame, f"Missing: {display_ppe}", (x1, max(24, y1 - 10)), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 0, 255), 2)
                        state_text = " | ".join(f"{'Goggles' if ppe == 'Glass' else ppe}: {'OK' if state_track.ppe[ppe].state in {'CONFIRMED', 'COMPLIANT'} else state_track.ppe[ppe].state}" for ppe in REQUIRED_PPE)
                        cv2.putText(evidence_frame, state_text, (x1, min(height - 10, y2 + 24)), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 220, 0), 2)
                        cv2.putText(evidence_frame, timestamp, (12, height - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
                        encoded_ok, encoded = cv2.imencode(".jpg", evidence_frame)
                        evidence = f"data:image/jpeg;base64,{base64.b64encode(encoded.tobytes()).decode('ascii')}" if encoded_ok else None
                        incidents.append(VisionIncidentSchema(incidentId=incident_id, trackId=str(track_id), violationType=f"Missing {display_ppe}", requiredPpe=display_ppe, timestamp=timestamp, frameNumber=frame_number, confidence=item.confidence, cameraId=camera_id, zone=cam_zone, evidenceImage=evidence))
                        self._active_incidents.add(key)
                elif key in self._active_incidents and state == "COMPLIANT":
                    self._active_incidents.remove(key)
                ppe_states[name] = state
                if name == "Glass":
                    ppe_states["Goggles"] = state
                    ppe_states["Safety Goggles"] = state
            person_summaries.append(PersonSafetySchema(trackId=str(track_id), boundingBox=BoundingBoxSchema(x=person_box[0] / width, y=person_box[1] / height, width=(person_box[2] - person_box[0]) / width, height=(person_box[3] - person_box[1]) / height), visible=visible, ppeStates=ppe_states, violationTypes=violation_types, skeleton=skeleton))

        ppe_summary = PPESummarySchema(
            person=len(persons) > 0,
            helmet=any(s.ppeStates.get("Helmet") in {"CONFIRMED", "COMPLIANT"} for s in person_summaries),
            vest=any(s.ppeStates.get("Vest") in {"CONFIRMED", "COMPLIANT"} for s in person_summaries),
            gloves=any(s.ppeStates.get("Glove") in {"CONFIRMED", "COMPLIANT"} for s in person_summaries),
            shoes=any(s.ppeStates.get("Boots") in {"CONFIRMED", "COMPLIANT"} for s in person_summaries),
            mask=any(s.ppeStates.get("Mask") in {"CONFIRMED", "COMPLIANT"} for s in person_summaries),
            goggles=any(s.ppeStates.get("Glass") in {"CONFIRMED", "COMPLIANT"} or s.ppeStates.get("Goggles") in {"CONFIRMED", "COMPLIANT"} for s in person_summaries),
        )

        fire_smoke_schema = FireSmokeSchema(
            hasFire=hazard_res.fire.has_fire,
            fireConfidence=hazard_res.fire.confidence,
            fireBbox=BoundingBoxSchema(
                x=hazard_res.fire.bbox[0],
                y=hazard_res.fire.bbox[1],
                width=hazard_res.fire.bbox[2],
                height=hazard_res.fire.bbox[3],
            ) if hazard_res.fire.bbox else None,
            hasSmoke=hazard_res.smoke.has_smoke,
            smokeConfidence=hazard_res.smoke.confidence,
            smokeBbox=BoundingBoxSchema(
                x=hazard_res.smoke.bbox[0],
                y=hazard_res.smoke.bbox[1],
                width=hazard_res.smoke.bbox[2],
                height=hazard_res.smoke.bbox[3],
            ) if hazard_res.smoke.bbox else None,
            smokeDensity=hazard_res.smoke.density,
        )

        elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
        return VisionFrameResponse(
            timestamp=timestamp,
            cameraId=camera_id,
            source=source,
            detections=detections,
            ppeSummary=ppe_summary,
            fireSmoke=fire_smoke_schema,
            persons=person_summaries,
            skeletons=all_skeletons,
            incidents=incidents,
            inferenceTimeMs=elapsed_ms,
        )


def create_ppe_detector() -> VisionDetector:
    project_root = Path(__file__).resolve().parents[2]
    model_path = os.getenv("XGUARDIAN_PPE_MODEL_PATH", str(project_root / "models" / "best.pt")).strip()
    if not Path(model_path).is_file():
        return UnavailablePPEDetector(f"PPE model checkpoint not found: {model_path}")
    return UltralyticsPPEDetector(model_path)