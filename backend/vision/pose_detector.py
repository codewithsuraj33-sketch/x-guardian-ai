"""Ultralytics YOLO Pose detector with temporal skeleton change and fall tracking."""

from __future__ import annotations

import math
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import numpy as np

from app.models.schemas import KeypointSchema, SkeletonPoseSchema

COCO_KEYPOINT_NAMES = [
    "nose",
    "left_eye",
    "right_eye",
    "left_ear",
    "right_ear",
    "left_shoulder",
    "right_shoulder",
    "left_elbow",
    "right_elbow",
    "left_wrist",
    "right_wrist",
    "left_hip",
    "right_hip",
    "left_knee",
    "right_knee",
    "left_ankle",
    "right_ankle",
]

# Standard COCO skeleton bone pairs (joint indices)
COCO_BONES = [
    (0, 1), (0, 2), (1, 3), (2, 4),  # Facial keypoints
    (5, 6),                           # Collar/shoulders
    (5, 7), (7, 9),                   # Left arm
    (6, 8), (8, 10),                  # Right arm
    (5, 11), (6, 12), (11, 12),       # Torso
    (11, 13), (13, 15),               # Left leg
    (12, 14), (14, 16),               # Right leg
]

FALL_ANGLE_THRESHOLD_DEG = 30.0       # Torso angle below this indicates horizontal/fallen body
BENDING_ANGLE_THRESHOLD_DEG = 65.0    # Torso angle between 30° and 65° suggests stoop/ergonomic strain
RAPID_DROP_VELOCITY_THRESHOLD = 0.35  # Normalized downward displacement per second
MIN_CONFIRMATION_FRAMES = 3           # Consecutive frames in fallen state to trigger alert
KEYPOINT_CONF_THRESH = 0.15           # Joint extraction confidence threshold


def compute_joint_angle(p1: np.ndarray, p2: np.ndarray, p3: np.ndarray) -> Optional[float]:
    """Compute the angle at vertex p2 formed by rays (p1 - p2) and (p3 - p2) in degrees."""
    v1 = p1[:2] - p2[:2]
    v2 = p3[:2] - p2[:2]
    norm1 = float(np.linalg.norm(v1))
    norm2 = float(np.linalg.norm(v2))
    if norm1 < 1e-4 or norm2 < 1e-4:
        return None
    cos_theta = float(np.dot(v1, v2) / (norm1 * norm2))
    cos_theta = max(-1.0, min(1.0, cos_theta))
    return float(math.degrees(math.acos(cos_theta)))


@dataclass
class PoseTrackHistory:
    last_keypoints: Optional[np.ndarray] = None
    last_hip_y: Optional[float] = None
    last_timestamp: float = field(default_factory=time.time)
    angle_history: List[float] = field(default_factory=list)
    fallen_frame_count: int = 0
    bending_frame_count: int = 0
    crouching_frame_count: int = 0
    is_confirmed_fall: bool = False
    last_posture: str = "STANDING"


@dataclass
class PoseExtractionResult:
    poses_by_track: Dict[int, SkeletonPoseSchema]
    all_skeletons: List[SkeletonPoseSchema]
    supplementary_persons: List[Tuple[int, List[float], float]]  # (track_id, [x1, y1, x2, y2], conf)


class SkeletonPoseTracker:
    """Tracks skeletal motion per person and detects posture anomalies, transitions, and falls."""

    def __init__(self, model_path: str):
        self.model_path = Path(model_path)
        self.model: Any = None
        self.device = "cpu"
        self.load_error: Optional[str] = None
        self._tracks: Dict[str, Dict[str, PoseTrackHistory]] = {}

        try:
            import torch
            from ultralytics import YOLO

            self.device = "cuda:0" if torch.cuda.is_available() else "cpu"
            if self.model_path.is_file():
                self.model = YOLO(str(self.model_path))
            else:
                self.load_error = f"Pose model file not found: {self.model_path}"
        except Exception as err:
            self.load_error = str(err)

    def is_ready(self) -> bool:
        return self.model is not None and self.model_path.is_file() and self.load_error is None

    def reset_session(self, camera_id: str) -> None:
        self._tracks.pop(camera_id, None)

    def analyze_pose(
        self,
        keypoints_array: np.ndarray,  # shape (17, 3) [x, y, conf]
        img_width: int,
        img_height: int,
        camera_id: str,
        track_id: Optional[str] = None,
    ) -> SkeletonPoseSchema:
        """Analyze a single person's 17 keypoints and evaluate posture and skeleton changes."""
        camera_tracks = self._tracks.setdefault(camera_id, {})
        tid = track_id or "unknown"
        history = camera_tracks.setdefault(tid, PoseTrackHistory())

        keypoint_schemas: List[KeypointSchema] = []
        for idx, (kx, ky, conf) in enumerate(keypoints_array):
            norm_x = float(np.clip(kx / max(img_width, 1), 0.0, 1.0))
            norm_y = float(np.clip(ky / max(img_height, 1), 0.0, 1.0))
            name = COCO_KEYPOINT_NAMES[idx] if idx < len(COCO_KEYPOINT_NAMES) else f"joint_{idx}"
            keypoint_schemas.append(
                KeypointSchema(
                    x=round(norm_x, 4),
                    y=round(norm_y, 4),
                    confidence=round(float(conf), 3),
                    name=name,
                )
            )

        # Compute key anatomical landmarks
        left_sh, right_sh = keypoints_array[5], keypoints_array[6]
        left_hip, right_hip = keypoints_array[11], keypoints_array[12]
        left_knee, right_knee = keypoints_array[13], keypoints_array[14]
        left_ankle, right_ankle = keypoints_array[15], keypoints_array[16]

        sh_pts = [p[:2] for p in (left_sh, right_sh) if p[2] >= KEYPOINT_CONF_THRESH]
        hip_pts = [p[:2] for p in (left_hip, right_hip) if p[2] >= KEYPOINT_CONF_THRESH]

        # Head points for upper-body fallback (nose, eyes, ears)
        head_pts = [p[:2] for p in keypoints_array[:5] if p[2] >= KEYPOINT_CONF_THRESH]

        torso_angle: Optional[float] = None
        drop_velocity: Optional[float] = None
        is_fall = False
        is_abnormal_posture = False
        posture_state = "STANDING"
        ergonomic_risk = "LOW"

        current_time = time.time()
        dt = max(0.02, current_time - history.last_timestamp)

        # 1. Torso Angle Calculation (Mid-shoulder to Mid-hip with Head Fallback)
        mid_hip: Optional[np.ndarray] = None
        if sh_pts and hip_pts:
            mid_shoulder = np.mean(sh_pts, axis=0)
            mid_hip = np.mean(hip_pts, axis=0)

            dx = float(mid_shoulder[0] - mid_hip[0])
            dy = float(mid_shoulder[1] - mid_hip[1])

            # In image coords, y increases downward.
            # Angle relative to horizontal plane (0 deg = flat/horizontal, 90 deg = vertical)
            torso_angle = round(float(math.degrees(math.atan2(abs(dy), abs(dx)))), 1)
        elif sh_pts and head_pts:
            # Upper-body fallback when hips are below frame / occluded
            mid_shoulder = np.mean(sh_pts, axis=0)
            mid_head = np.mean(head_pts, axis=0)
            dx = float(mid_head[0] - mid_shoulder[0])
            dy = float(mid_head[1] - mid_shoulder[1])
            torso_angle = round(float(math.degrees(math.atan2(abs(dy), abs(dx)))), 1)

        if torso_angle is not None:
            history.angle_history.append(torso_angle)
            history.angle_history = history.angle_history[-10:]

        # 2. Downward Velocity Tracking
        if mid_hip is not None:
            norm_hip_y = float(mid_hip[1] / max(img_height, 1))
            if history.last_hip_y is not None:
                drop_velocity = round((norm_hip_y - history.last_hip_y) / dt, 3)
            history.last_hip_y = norm_hip_y
        elif sh_pts:
            norm_sh_y = float(np.mean(sh_pts, axis=0)[1] / max(img_height, 1))
            if history.last_hip_y is not None:
                drop_velocity = round((norm_sh_y - history.last_hip_y) / dt, 3)
            history.last_hip_y = norm_sh_y

        # 3. Knee Flexion Evaluation for Sitting & Crouching / Squatting
        knee_angles: List[float] = []
        if left_hip[2] >= KEYPOINT_CONF_THRESH and left_knee[2] >= KEYPOINT_CONF_THRESH and left_ankle[2] >= KEYPOINT_CONF_THRESH:
            l_angle = compute_joint_angle(left_hip, left_knee, left_ankle)
            if l_angle is not None:
                knee_angles.append(l_angle)

        if right_hip[2] >= KEYPOINT_CONF_THRESH and right_knee[2] >= KEYPOINT_CONF_THRESH and right_ankle[2] >= KEYPOINT_CONF_THRESH:
            r_angle = compute_joint_angle(right_hip, right_knee, right_ankle)
            if r_angle is not None:
                knee_angles.append(r_angle)

        avg_knee_angle = float(np.mean(knee_angles)) if knee_angles else None

        # 4. Posture and Fall Evaluation
        # Sudden vertical collapse: high downward drop velocity + low torso angle
        if drop_velocity is not None and drop_velocity > RAPID_DROP_VELOCITY_THRESHOLD and (torso_angle is not None and torso_angle < 50.0):
            history.fallen_frame_count += 3

        # A) Emergency Fall / Collapse
        if torso_angle is not None and torso_angle < FALL_ANGLE_THRESHOLD_DEG:
            history.fallen_frame_count += 1
            if history.fallen_frame_count >= MIN_CONFIRMATION_FRAMES:
                posture_state = "FALLEN"
                is_fall = True
                history.is_confirmed_fall = True
                ergonomic_risk = "HIGH"
            else:
                posture_state = "BENDING"
                is_abnormal_posture = True
                ergonomic_risk = "MODERATE"

        # B) Sitting / Crouching Detection
        elif avg_knee_angle is not None and avg_knee_angle < 125.0:
            history.fallen_frame_count = max(0, history.fallen_frame_count - 1)
            history.crouching_frame_count += 1
            if torso_angle is not None and torso_angle < 55.0:
                posture_state = "CROUCHING"
                is_abnormal_posture = True
                ergonomic_risk = "MODERATE"
            else:
                posture_state = "SITTING" if history.crouching_frame_count > 6 else "CROUCHING"
                ergonomic_risk = "LOW" if posture_state == "SITTING" else "MODERATE"

        # C) Stoop / Ergonomic Bending Strain
        elif torso_angle is not None and torso_angle < BENDING_ANGLE_THRESHOLD_DEG:
            history.fallen_frame_count = max(0, history.fallen_frame_count - 1)
            history.bending_frame_count += 1
            posture_state = "BENDING"
            is_abnormal_posture = True
            ergonomic_risk = "HIGH" if history.bending_frame_count > 15 else "MODERATE"

        # D) Normal Standing Posture
        else:
            history.fallen_frame_count = max(0, history.fallen_frame_count - 2)
            history.bending_frame_count = max(0, history.bending_frame_count - 2)
            history.crouching_frame_count = max(0, history.crouching_frame_count - 1)
            posture_state = "STANDING"
            history.is_confirmed_fall = False
            ergonomic_risk = "LOW"

        # 5. Temporal Skeleton Change Metric (Displacement between consecutive frames)
        pose_change: Optional[float] = None
        if history.last_keypoints is not None:
            valid_mask = (keypoints_array[:, 2] >= KEYPOINT_CONF_THRESH) & (history.last_keypoints[:, 2] >= KEYPOINT_CONF_THRESH)
            if np.any(valid_mask):
                curr_norm = keypoints_array[valid_mask, :2] / np.array([max(img_width, 1), max(img_height, 1)])
                prev_norm = history.last_keypoints[valid_mask, :2] / np.array([max(img_width, 1), max(img_height, 1)])
                displacements = np.linalg.norm(curr_norm - prev_norm, axis=1)
                pose_change = round(float(np.mean(displacements)), 4)

        # 6. Posture Transition Detection
        posture_transition: Optional[str] = None
        if history.last_posture != posture_state:
            posture_transition = f"{history.last_posture} -> {posture_state}"

        history.last_keypoints = keypoints_array.copy()
        history.last_timestamp = current_time
        history.last_posture = posture_state

        return SkeletonPoseSchema(
            trackId=track_id,
            keypoints=keypoint_schemas,
            postureState=posture_state,
            torsoAngle=torso_angle,
            isFall=is_fall,
            isAbnormalPosture=is_abnormal_posture,
            dropVelocity=drop_velocity,
            poseChange=pose_change,
            postureTransition=posture_transition,
            ergonomicRisk=ergonomic_risk,
        )

    def extract_poses(
        self,
        image: np.ndarray,
        camera_id: str,
        persons: Dict[int, List[float]],
    ) -> PoseExtractionResult:
        """
        Run YOLOv8-Pose on the image, accurately match detected skeletons to persons,
        and retain 100% of detected skeletons and supplementary persons.
        """
        if not self.is_ready():
            return PoseExtractionResult(poses_by_track={}, all_skeletons=[], supplementary_persons=[])

        height, width = image.shape[:2]
        try:
            results = self.model(
                source=image,
                device=self.device,
                conf=0.20,
                iou=0.5,
                verbose=False,
            )
        except Exception:
            return PoseExtractionResult(poses_by_track={}, all_skeletons=[], supplementary_persons=[])

        if not results or results[0].keypoints is None:
            return PoseExtractionResult(poses_by_track={}, all_skeletons=[], supplementary_persons=[])

        res = results[0]
        kp_data = res.keypoints.data.cpu().numpy()  # shape (N, 17, 3)
        boxes = res.boxes.xyxy.cpu().numpy() if res.boxes is not None else []
        box_confs = res.boxes.conf.cpu().numpy() if res.boxes is not None else []

        poses_by_track: Dict[int, SkeletonPoseSchema] = {}
        all_skeletons: List[SkeletonPoseSchema] = []
        supplementary_persons: List[Tuple[int, List[float], float]] = []
        matched_track_ids: Set[int] = set()

        for idx, kps in enumerate(kp_data):
            p_box = boxes[idx] if idx < len(boxes) else None
            p_conf = float(box_confs[idx]) if idx < len(box_confs) else 0.5
            matched_track_id: Optional[int] = None

            if p_box is not None and persons:
                bc_x, bc_y = (p_box[0] + p_box[2]) / 2, (p_box[1] + p_box[3]) / 2
                best_dist = float("inf")
                for tid, target_box in persons.items():
                    if tid in matched_track_ids:
                        continue
                    t_bc_x, t_bc_y = (target_box[0] + target_box[2]) / 2, (target_box[1] + target_box[3]) / 2
                    box_diag = (target_box[2] - target_box[0]) ** 2 + (target_box[3] - target_box[1]) ** 2
                    dist = (bc_x - t_bc_x) ** 2 + (bc_y - t_bc_y) ** 2
                    if dist < best_dist and dist < box_diag * 1.5:
                        best_dist = dist
                        matched_track_id = tid

            # If no box matched but exactly 1 person is tracked and not yet assigned
            if matched_track_id is None and len(persons) == 1:
                single_tid = list(persons.keys())[0]
                if single_tid not in matched_track_ids:
                    matched_track_id = single_tid

            # If still unmatched, assign a synthetic track ID so the skeleton is NEVER discarded
            if matched_track_id is not None:
                matched_track_ids.add(matched_track_id)
                assigned_tid_str = str(matched_track_id)
                assigned_tid_int = matched_track_id
            else:
                synthetic_id = 101 + idx
                while synthetic_id in persons or synthetic_id in matched_track_ids:
                    synthetic_id += 1
                matched_track_ids.add(synthetic_id)
                assigned_tid_int = synthetic_id
                assigned_tid_str = f"P-{synthetic_id}"
                if p_box is not None and p_conf >= 0.30:
                    supplementary_persons.append((synthetic_id, [float(c) for c in p_box], p_conf))

            pose_schema = self.analyze_pose(
                keypoints_array=kps,
                img_width=width,
                img_height=height,
                camera_id=camera_id,
                track_id=assigned_tid_str,
            )

            poses_by_track[assigned_tid_int] = pose_schema
            all_skeletons.append(pose_schema)

        return PoseExtractionResult(
            poses_by_track=poses_by_track,
            all_skeletons=all_skeletons,
            supplementary_persons=supplementary_persons,
        )
