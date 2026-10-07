"""
X-Guardian — Standalone YOLO PPE & Pose Detection Demo Runner
Run real-time inference on webcam, video file, or image using models/best.pt and models/yolov8n-pose.pt.

Usage:
    python detect_demo.py                     # Runs on default webcam (0)
    python detect_demo.py --source 0          # Runs on webcam index 0
    python detect_demo.py --source video.mp4  # Runs on a video file
    python detect_demo.py --source photo.jpg  # Runs on an image
    python detect_demo.py --save              # Save output video / image
"""

import argparse
import sys
import time
from pathlib import Path

# Add backend directory to path
project_root = Path(__file__).resolve().parent
sys.path.insert(0, str(project_root / "backend"))

import cv2
import numpy as np


def main():
    parser = argparse.ArgumentParser(description="X-Guardian YOLO PPE & Fall Detection Demo")
    parser.add_argument(
        "--source",
        default="0",
        help="Input source: camera index (0, 1), video file path, or image path",
    )
    parser.add_argument(
        "--conf",
        type=float,
        default=0.40,
        help="Confidence threshold for detection (default: 0.40)",
    )
    parser.add_argument(
        "--save",
        action="store_true",
        help="Save annotated video or image output to disk",
    )
    args = parser.parse_args()

    # Import the PPE detector
    try:
        from vision.ppe_detector import create_ppe_detector
    except ImportError as e:
        print(f"[-] Error loading vision detector module: {e}")
        return

    print("=" * 65)
    print("  🛡️  X-GUARDIAN AI — YOLO INDUSTRIAL SAFETY DETECTOR")
    print("=" * 65)
    print(f"[*] Initializing YOLO models from: {project_root / 'models'}")
    
    detector = create_ppe_detector()
    if not detector.is_ready():
        print(f"[-] Error: Detector engine is not ready: {getattr(detector, 'reason', 'Unknown error')}")
        return

    model_names = getattr(detector.model, "names", {})
    print(f"[+] Loaded PPE Model Classes: {list(model_names.values())}")
    has_pose = detector.pose_tracker is not None and detector.pose_tracker.is_ready()
    print(f"[+] Skeleton Pose & Fall Detection: {'ACTIVE' if has_pose else 'DISABLED'}")
    print(f"[+] Device: {detector.device}")
    print("-" * 65)

    source_val = args.source
    is_webcam = source_val.isdigit()
    source_input = int(source_val) if is_webcam else source_val

    # Test if source is a single static image
    is_image = False
    if not is_webcam and Path(source_val).is_file():
        ext = Path(source_val).suffix.lower()
        if ext in [".jpg", ".jpeg", ".png", ".bmp", ".webp"]:
            is_image = True

    if is_image:
        print(f"[*] Processing static image: {source_val}")
        frame = cv2.imread(source_val)
        if frame is None:
            print(f"[-] Failed to read image: {source_val}")
            return
        
        _, encoded = cv2.imencode(".jpg", frame)
        result = detector.detect(encoded.tobytes(), camera_id="CAM-DEMO", source="image")
        
        print(f"[+] Inference Time: {result.inferenceTimeMs} ms")
        print(f"[+] Detections: {len(result.detections)}")
        print(f"[+] Persons Tracked: {len(result.persons)}")
        for person in result.persons:
            print(f"    - Worker {person.trackId}: Missing: {person.violationTypes or 'None (Compliant)'}")

        # Render on frame
        annotated = render_hud(frame, result)
        if args.save:
            out_path = f"annotated_{Path(source_val).name}"
            cv2.imwrite(out_path, annotated)
            print(f"[+] Saved output to: {out_path}")
        
        cv2.imshow("X-Guardian YOLO Detector (Press any key to close)", annotated)
        cv2.waitKey(0)
        cv2.destroyAllWindows()
        return

    # Video or Webcam Stream
    cap = cv2.VideoCapture(source_input)
    if not cap.isOpened():
        print(f"[-] Could not open video/webcam source: {source_val}")
        return

    print(f"[*] Starting video stream from: {source_val}")
    print("[*] Press 'q' or 'ESC' in the preview window to exit.")

    out_writer = None
    if args.save:
        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        out_path = "x_guardian_output.mp4"
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        out_writer = cv2.VideoWriter(out_path, fourcc, fps, (w, h))
        print(f"[*] Recording output to: {out_path}")

    fps_history = []
    
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                print("[*] End of video stream.")
                break

            t0 = time.perf_counter()
            _, encoded = cv2.imencode(".jpg", frame)
            result = detector.detect(encoded.tobytes(), camera_id="CAM-LIVE", source="webcam" if is_webcam else "video")
            t_diff = time.perf_counter() - t0
            
            fps = 1.0 / max(t_diff, 1e-4)
            fps_history.append(fps)
            if len(fps_history) > 30:
                fps_history.pop(0)
            avg_fps = sum(fps_history) / len(fps_history)

            annotated = render_hud(frame, result, avg_fps=avg_fps)

            if out_writer is not None:
                out_writer.write(annotated)

            cv2.imshow("X-Guardian AI — Live PPE & Pose Detection (Press 'q' to quit)", annotated)
            key = cv2.waitKey(1) & 0xFF
            if key in [ord("q"), ord("Q"), 27]:
                break

    finally:
        cap.release()
        if out_writer is not None:
            out_writer.release()
        cv2.destroyAllWindows()
        print("[+] Session ended.")


def render_hud(frame: np.ndarray, result, avg_fps: float = None) -> np.ndarray:
    """Draw bounding boxes, skeletons, and status banners on the image."""
    h, w = frame.shape[:2]
    canvas = frame.copy()

    # Draw skeletons if any
    for skel in getattr(result, "skeletons", []):
        kp = skel.keypoints
        # Draw joints
        for pt in kp:
            if pt.confidence > 0.2:
                cx, cy = int(pt.x * w), int(pt.y * h)
                cv2.circle(canvas, (cx, cy), 4, (0, 255, 255), -1)

    # Draw persons & PPE violations
    for p in getattr(result, "persons", []):
        bx = int(p.boundingBox.x * w)
        by = int(p.boundingBox.y * h)
        bw = int(p.boundingBox.width * w)
        bh = int(p.boundingBox.height * h)

        is_fall = getattr(p.skeleton, "isFall", False) if p.skeleton else False
        has_violations = len(p.violationTypes) > 0 or is_fall

        color = (0, 0, 255) if is_fall else ((0, 69, 255) if has_violations else (0, 220, 0))
        cv2.rectangle(canvas, (bx, by), (bx + bw, by + bh), color, 2)

        # Label badge
        badge_title = f"ID: {p.trackId} | {'🚨 FALL DETECTED' if is_fall else ('⚠️ VIOLATION' if has_violations else '✓ SAFE')}"
        cv2.rectangle(canvas, (bx, max(0, by - 26)), (bx + max(200, bw), by), color, -1)
        cv2.putText(canvas, badge_title, (bx + 5, max(18, by - 7)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1)

        # Missing items text
        if has_violations and not is_fall:
            missing_text = f"Missing: {', '.join([v.replace('Missing ', '') for v in p.violationTypes])}"
            cv2.putText(canvas, missing_text, (bx, min(h - 5, by + bh + 16)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 255), 1)

    # Draw top stats HUD bar
    cv2.rectangle(canvas, (0, 0), (w, 36), (15, 23, 42), -1)
    status_text = f"X-GUARDIAN AI | Model: YOLOv8-PPE | Monitored: {len(result.persons)}"
    if avg_fps:
        status_text += f" | {avg_fps:.1f} FPS"
    status_text += f" | Latency: {result.inferenceTimeMs:.0f}ms"
    cv2.putText(canvas, status_text, (12, 23), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1)

    return canvas


if __name__ == "__main__":
    main()
