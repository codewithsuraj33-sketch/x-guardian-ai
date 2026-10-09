# ─────────────────────────────────────────────
# X-Guardian — RTSP / IP Camera & Mobile Stream Manager
# Multi-camera ingestion with OpenCV, YOLOv8 PPE detection, and live MJPEG streaming
# ─────────────────────────────────────────────

import time
import math
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Generator, Optional, List
try:
    import cv2  # type: ignore
except ImportError:
    cv2 = None
import numpy as np

# Initial factory camera presets
DEFAULT_CAMERAS: Dict[str, Dict[str, Any]] = {
    "CAM-01": {
        "id": "CAM-01",
        "name": "Entry Sector Gate",
        "zoneId": "ZONE-01",
        "streamUrl": "demo",
        "fps": 10,
        "status": "ONLINE",
        "resolution": "1920x1080",
    },
    "CAM-02": {
        "id": "CAM-02",
        "name": "Main Assembly Line",
        "zoneId": "ZONE-02",
        "streamUrl": "demo",
        "fps": 10,
        "status": "ONLINE",
        "resolution": "1920x1080",
    },
    "CAM-03": {
        "id": "CAM-03",
        "name": "High-Temp Welding Cell",
        "zoneId": "ZONE-03",
        "streamUrl": "demo",
        "fps": 10,
        "status": "ONLINE",
        "resolution": "1920x1080",
    },
    "CAM-04": {
        "id": "CAM-04",
        "name": "Warehouse Logistics",
        "zoneId": "ZONE-04",
        "streamUrl": "demo",
        "fps": 10,
        "status": "ONLINE",
        "resolution": "1920x1080",
    },
    "CAM-05": {
        "id": "CAM-05",
        "name": "Hazard Restricted Zone",
        "zoneId": "ZONE-05",
        "streamUrl": "demo",
        "fps": 10,
        "status": "ONLINE",
        "resolution": "1920x1080",
    },
}

COCO_BONES = [
    (0, 1), (0, 2), (1, 3), (2, 4),      # Facial keypoints
    (5, 6),                              # Shoulders
    (5, 7), (7, 9),                      # Left arm (shoulder->elbow->wrist)
    (6, 8), (8, 10),                     # Right arm (shoulder->elbow->wrist)
    (5, 11), (6, 12),                    # Torso sides
    (11, 12),                            # Hips
    (11, 13), (13, 15),                  # Left leg (hip->knee->ankle)
    (12, 14), (14, 16),                  # Right leg (hip->knee->ankle)
]


class ThreadedStreamReader:
    """
    Reads an RTSP or HTTP MJPEG video stream asynchronously in a dedicated worker thread,
    continually draining the internal buffer so the main streamer always receives
    the newest live frame with 0 ms buffer latency.
    """
    def __init__(self, src: Any):
        self.src = src
        self.cap = None
        self.latest_frame: Optional[np.ndarray] = None
        self.running = True
        self.lock = threading.Lock()
        self._connect()
        self.thread = threading.Thread(target=self._worker, daemon=True)
        self.thread.start()

    def _connect(self):
        if cv2 is None:
            return
        try:
            source = int(self.src) if str(self.src).isdigit() else self.src
            os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;udp|timeout;2000000"
            if self.cap:
                try:
                    self.cap.release()
                except Exception:
                    pass
            self.cap = cv2.VideoCapture(source)
            if self.cap.isOpened():
                self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        except Exception:
            pass

    def _worker(self):
        while self.running:
            if self.cap and self.cap.isOpened():
                ret, frame = self.cap.read()
                if ret and frame is not None:
                    with self.lock:
                        self.latest_frame = frame
                else:
                    time.sleep(0.01)
            else:
                time.sleep(1.0)
                self._connect()

    def get_frame(self) -> Optional[np.ndarray]:
        with self.lock:
            return self.latest_frame.copy() if self.latest_frame is not None else None

    def is_alive(self) -> bool:
        return self.running and (self.cap is not None and self.cap.isOpened())

    def stop(self):
        self.running = False
        if self.cap:
            try:
                self.cap.release()
            except Exception:
                pass


class StreamManager:
    def __init__(self):
        self._cameras: Dict[str, Dict[str, Any]] = dict(DEFAULT_CAMERAS)
        self._latest_frames: Dict[str, bytes] = {}
        self._latest_telemetry: Dict[str, Any] = {}
        self._readers: Dict[str, ThreadedStreamReader] = {}
        self._lock = threading.Lock()

    def get_all_cameras(self) -> List[Dict[str, Any]]:
        with self._lock:
            return list(self._cameras.values())

    def get_camera(self, camera_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            return self._cameras.get(camera_id)

    def get_latest_telemetry(self, camera_id: str) -> Optional[Any]:
        with self._lock:
            return self._latest_telemetry.get(camera_id)

    def register_camera(
        self,
        camera_id: str,
        name: str,
        zone_id: str,
        stream_url: str = "demo",
        fps: int = 10,
    ) -> Dict[str, Any]:
        cleaned_url = stream_url.strip()
        # Normalization: If user provided IP Webcam without /video, e.g. http://192.168.1.5:8080 or 192.168.1.5:8080
        if cleaned_url.startswith("192.") or cleaned_url.startswith("10.") or cleaned_url.startswith("172."):
            cleaned_url = f"http://{cleaned_url}"
        if cleaned_url.endswith(":8080") or cleaned_url.endswith(":8080/"):
            cleaned_url = cleaned_url.rstrip("/") + "/video"

        cam = {
            "id": camera_id,
            "name": name,
            "zoneId": zone_id,
            "streamUrl": cleaned_url,
            "fps": max(1, min(30, fps)),
            "status": "ONLINE",
            "resolution": "1080p",
            "isCustom": True,
        }
        with self._lock:
            self._cameras[camera_id] = cam
        return cam

    def delete_camera(self, camera_id: str) -> bool:
        with self._lock:
            if camera_id in self._cameras:
                del self._cameras[camera_id]
                self._latest_frames.pop(camera_id, None)
                return True
        return False

    def test_stream_connection(self, stream_url: str) -> Dict[str, Any]:
        """
        Attempts to connect to an RTSP, HTTP MJPEG, or local camera URL.
        Returns connection status and detected resolution/FPS.
        """
        if cv2 is None:
            return {"success": False, "error": "OpenCV (cv2) is not installed."}

        url = stream_url.strip()
        if not url:
            return {"success": False, "error": "Stream URL cannot be empty."}

        if url.startswith("192.") or url.startswith("10.") or url.startswith("172."):
            url = f"http://{url}"
        if url.endswith(":8080") or url.endswith(":8080/"):
            url = url.rstrip("/") + "/video"

        source = int(url) if url.isdigit() else url

        # Fast connection probe
        os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;udp|timeout;3000000"
        cap = cv2.VideoCapture(source)
        try:
            if not cap.isOpened():
                return {
                    "success": False,
                    "error": f"Could not connect to stream at {url}. Ensure phone/camera is on same Wi-Fi.",
                }

            ret, frame = cap.read()
            if not ret or frame is None:
                return {
                    "success": False,
                    "error": "Connected to stream, but failed to read initial video frame.",
                }

            h, w = frame.shape[:2]
            fps = cap.get(cv2.CAP_PROP_FPS) or 15
            return {
                "success": True,
                "resolution": f"{w}x{h}",
                "fps": int(fps),
                "url": url,
                "message": f"Successfully connected! Resolution: {w}x{h} @ {int(fps)} FPS",
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
        finally:
            cap.release()

    def get_latest_frame(self, camera_id: str) -> Optional[bytes]:
        return self._latest_frames.get(camera_id)

    def _render_synthetic_frame(
        self,
        camera_id: str,
        camera_name: str,
        zone_id: str,
        tick: int,
        has_violation: bool = False,
    ) -> bytes:
        """
        Renders a realistic dark industrial CCTV surveillance frame
        with timecodes, optical crosshairs, zone branding, and simulated worker AI reticles.
        """
        width, height = 640, 360
        frame = np.full((height, width, 3), (18, 14, 11), dtype=np.uint8)

        # Floor grid lines
        for y in range(80, height, 40):
            cv2.line(frame, (0, y), (width, y), (30, 26, 22), 1)
        for x in range(0, width, 60):
            cv2.line(frame, (x, 60), (x, height), (30, 26, 22), 1)

        # Perspective hazard floor marking for zone
        if "05" in zone_id or "03" in zone_id or "MOBILE" in camera_id.upper():
            pts = np.array([[120, 200], [520, 200], [600, 340], [40, 340]], np.int32)
            cv2.polylines(frame, [pts], True, (0, 140, 255) if "05" in zone_id else (0, 80, 220), 2)
            cv2.putText(frame, "HAZARD BOUNDARY", (240, 215), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 140, 255), 1)

        # Worker oscillation
        speed_factor = (tick * 0.05) % (2 * math.pi)
        worker_x = int(240 + math.sin(speed_factor) * 160)
        worker_y = int(140 + math.cos(speed_factor) * 30)
        worker_w = 70
        worker_h = 130

        box_color = (40, 40, 235) if has_violation else (40, 200, 80)
        label_color = (0, 0, 255) if has_violation else (0, 180, 60)

        cv2.rectangle(
            frame,
            (worker_x, worker_y),
            (worker_x + worker_w, worker_y + worker_h),
            box_color,
            2,
        )

        label_text = f"ID: W-{camera_id[-2:]}1 | " + ("PPE VIOLATION: NO HELMET" if has_violation else "PPE COMPLIANT 98%")
        cv2.rectangle(
            frame,
            (worker_x, max(15, worker_y - 20)),
            (worker_x + 220, max(35, worker_y)),
            label_color,
            -1,
        )
        cv2.putText(
            frame,
            label_text,
            (worker_x + 4, max(30, worker_y - 5)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.35,
            (255, 255, 255),
            1,
        )

        # CCTV corner reticles
        bracket_len = 16
        color_reticle = (70, 60, 50)
        cv2.line(frame, (10, 10), (10 + bracket_len, 10), color_reticle, 2)
        cv2.line(frame, (10, 10), (10, 10 + bracket_len), color_reticle, 2)
        cv2.line(frame, (width - 10, 10), (width - 10 - bracket_len, 10), color_reticle, 2)
        cv2.line(frame, (width - 10, 10), (width - 10, 10 + bracket_len), color_reticle, 2)
        cv2.line(frame, (10, height - 10), (10 + bracket_len, height - 10), color_reticle, 2)
        cv2.line(frame, (10, height - 10), (10, height - 10 - bracket_len), color_reticle, 2)
        cv2.line(frame, (width - 10, height - 10), (width - 10 - bracket_len, height - 10), color_reticle, 2)
        cv2.line(frame, (width - 10, height - 10), (width - 10, height - 10 - bracket_len), color_reticle, 2)

        # OSD Watermark
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        osd_title = f"{camera_id} • {camera_name.upper()} • {zone_id}"
        cv2.putText(frame, osd_title, (24, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (200, 200, 200), 1)
        cv2.putText(frame, now_str, (24, 42), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (130, 130, 130), 1)

        # Pulsing REC indicator
        rec_color = (0, 0, 240) if (tick % 10 < 7) else (80, 80, 80)
        cv2.circle(frame, (width - 60, 24), 5, rec_color, -1)
        cv2.putText(frame, "REC", (width - 48, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (200, 200, 200), 1)

        # Tech Telemetry
        cv2.putText(
            frame,
            "X-GUARDIAN AI VISION CORE • YOLOV8 PPE • IP/RTSP STREAM",
            (24, height - 18),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.35,
            (0, 180, 240),
            1,
        )

        _, encoded = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        return encoded.tobytes()

    def generate_mjpeg_stream(
        self,
        camera_id: str,
        detector: Optional[Any] = None,
        db_saver: Optional[Any] = None,
    ) -> Generator[bytes, None, None]:
        """
        Yields multipart MJPEG stream frames directly viewable in any <img> tag or canvas.
        Handles real RTSP / IP streams when available with live YOLOv8 PPE detection.
        """
        camera = self.get_camera(camera_id)
        if not camera:
            camera = {
                "id": camera_id,
                "name": f"Camera {camera_id}",
                "zoneId": "ZONE-01",
                "streamUrl": "demo",
                "fps": 10,
            }

        stream_url = camera.get("streamUrl", "demo")
        target_fps = camera.get("fps", 10)
        frame_interval = 1.0 / max(1, target_fps)

        reader = None
        if stream_url and stream_url != "demo" and cv2 is not None:
            with self._lock:
                existing = self._readers.get(camera_id)
                if existing and existing.src == stream_url and existing.is_alive():
                    reader = existing
                else:
                    if existing:
                        existing.stop()
                    reader = ThreadedStreamReader(stream_url)
                    self._readers[camera_id] = reader

        tick = 0
        last_detect_time = 0
        latest_detections = []
        latest_persons = []
        latest_skeletons = []

        try:
            while True:
                start_time = time.perf_counter()
                tick += 1

                jpeg_bytes: Optional[bytes] = None

                if reader and reader.is_alive():
                    frame = reader.get_frame()
                    if frame is not None:
                        h, w = frame.shape[:2]

                        # Zero-lag downscale: scale down 1080p to 854x480 for 5x faster processing and zero Wi-Fi lag
                        if w > 854:
                            scale = 854.0 / w
                            frame = cv2.resize(frame, (854, int(h * scale)), interpolation=cv2.INTER_LINEAR)
                            h, w = frame.shape[:2]

                        # Run YOLOv8 detection at configured interval (~6 times/sec)
                        now = time.time()
                        if detector and getattr(detector, "is_ready", lambda: False)() and (now - last_detect_time >= 0.16):
                            last_detect_time = now
                            try:
                                _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
                                res = detector.detect(buf.tobytes(), camera_id=camera_id, source="ip_camera")
                                latest_detections = res.detections or []
                                latest_persons = res.persons or []
                                latest_skeletons = res.skeletons or []
                                with self._lock:
                                    self._latest_telemetry[camera_id] = res

                                # Persist any safety violations or incidents
                                if res.incidents and db_saver:
                                    for inc in res.incidents:
                                        try:
                                            sev = "CRITICAL" if ("fall" in inc.violationType.lower() or "fire" in inc.violationType.lower()) else "HIGH"
                                            db_saver(
                                                incident_id=inc.incidentId,
                                                camera_id=camera_id,
                                                violation=inc.violationType,
                                                severity=sev,
                                                worker_id=f"W-{inc.trackId}",
                                                track_id=str(inc.trackId),
                                                zone_id=camera.get("zoneId", "ZONE-01"),
                                                confidence=inc.confidence or 0.92,
                                                frame_number=tick,
                                                timestamp=inc.timestamp,
                                                evidence_image=inc.evidenceImage,
                                            )
                                        except Exception as dberr:
                                            print(f"Error persisting stream incident: {dberr}")
                            except Exception as det_err:
                                print(f"Live detection warning: {det_err}")

                        # 1. Draw Skeleton Pose connections, joints & posture analysis
                        for skel in latest_skeletons:
                            kps = skel.keypoints
                            if not kps or len(kps) < 5:
                                continue

                            is_fall = skel.isFall or skel.postureState == "FALLEN"
                            is_bending = skel.isAbnormalPosture or skel.postureState == "BENDING"
                            bone_color = (0, 0, 245) if is_fall else ((0, 180, 255) if is_bending else (240, 210, 0))
                            joint_color = (255, 255, 255) if is_fall else ((180, 255, 255) if is_bending else (100, 255, 100))

                            # Draw bones
                            for p1_idx, p2_idx in COCO_BONES:
                                if p1_idx < len(kps) and p2_idx < len(kps):
                                    kp1 = kps[p1_idx]
                                    kp2 = kps[p2_idx]
                                    if kp1.confidence > 0.35 and kp2.confidence > 0.35:
                                        x1, y1 = int(kp1.x * w), int(kp1.y * h)
                                        x2, y2 = int(kp2.x * w), int(kp2.y * h)
                                        cv2.line(frame, (x1, y1), (x2, y2), bone_color, 2, cv2.LINE_AA)

                            # Draw joint dots & anchor head position
                            head_y = h
                            head_x = w // 2
                            for idx, kp in enumerate(kps):
                                if kp.confidence > 0.35:
                                    kx, ky = int(kp.x * w), int(kp.y * h)
                                    cv2.circle(frame, (kx, ky), 4, joint_color, -1, cv2.LINE_AA)
                                    cv2.circle(frame, (kx, ky), 5, (20, 20, 20), 1, cv2.LINE_AA)
                                    if idx == 0:
                                        head_x, head_y = kx, ky

                            # Posture badge over head
                            posture_text = f"POSE: {skel.postureState}"
                            if skel.torsoAngle is not None:
                                posture_text += f" ({int(skel.torsoAngle)} deg)"
                            if is_fall:
                                posture_text = "🚨 FALL DETECTED (MAN DOWN)"
                            psize = cv2.getTextSize(posture_text, cv2.FONT_HERSHEY_SIMPLEX, 0.36, 1)[0]
                            p_badge_y = max(18, head_y - 24)
                            cv2.rectangle(frame, (head_x - psize[0] // 2 - 4, p_badge_y - 14), (head_x + psize[0] // 2 + 4, p_badge_y + 2), (20, 20, 20), -1)
                            cv2.putText(frame, posture_text, (head_x - psize[0] // 2, p_badge_y - 3), cv2.FONT_HERSHEY_SIMPLEX, 0.36, bone_color, 1)

                        # 2. Draw Worker / Person bounding boxes with comprehensive safety status
                        has_worker_violation = False
                        for person in latest_persons:
                            bx = int(person.boundingBox.x * w)
                            by = int(person.boundingBox.y * h)
                            bw = int(person.boundingBox.width * w)
                            bh = int(person.boundingBox.height * h)

                            is_violation = len(person.violationTypes) > 0
                            if is_violation:
                                has_worker_violation = True

                            border_color = (30, 30, 240) if is_violation else (40, 210, 80)
                            badge_color = (0, 0, 200) if is_violation else (20, 150, 50)

                            # Worker main box
                            cv2.rectangle(frame, (bx, by), (bx + bw, by + bh), border_color, 2)

                            # Worker top badge
                            status_str = f"WORKER W-{person.trackId} | {'PPE VIOLATION' if is_violation else 'PPE COMPLIANT'}"
                            tsize = cv2.getTextSize(status_str, cv2.FONT_HERSHEY_SIMPLEX, 0.42, 1)[0]
                            badge_y1 = max(0, by - 20)
                            cv2.rectangle(frame, (bx, badge_y1), (bx + tsize[0] + 10, by), badge_color, -1)
                            cv2.putText(frame, status_str, (bx + 5, by - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255, 255, 255), 1)

                            # Bottom tags: Helmet, Vest, Goggles, Boots, Gloves
                            states = person.ppeStates or {}
                            gear_tags = []
                            h_st = states.get("Helmet", "UNKNOWN")
                            v_st = states.get("Vest", "UNKNOWN")
                            gl_st = states.get("Glass", states.get("Goggles", "UNKNOWN"))
                            b_st = states.get("Boots", "UNKNOWN")
                            g_st = states.get("Glove", "UNKNOWN")

                            if h_st in ("CONFIRMED", "COMPLIANT", "DETECTED"):
                                gear_tags.append(("[HELMET OK]", (40, 220, 80)))
                            else:
                                gear_tags.append(("[NO HELMET]", (0, 50, 255)))

                            if v_st in ("CONFIRMED", "COMPLIANT", "DETECTED"):
                                gear_tags.append(("[VEST OK]", (40, 220, 80)))
                            else:
                                gear_tags.append(("[NO VEST]", (0, 50, 255)))

                            if gl_st in ("CONFIRMED", "COMPLIANT", "DETECTED"):
                                gear_tags.append(("[GOGGLES OK]", (40, 220, 80)))
                            else:
                                gear_tags.append(("[NO GOGGLES]", (0, 160, 255)))

                            if b_st in ("CONFIRMED", "COMPLIANT", "DETECTED"):
                                gear_tags.append(("[BOOTS OK]", (40, 220, 80)))

                            if g_st in ("CONFIRMED", "COMPLIANT", "DETECTED"):
                                gear_tags.append(("[GLOVES OK]", (40, 220, 80)))

                            # Render gear tags underneath
                            tag_x = bx
                            tag_y = min(h - 6, by + bh + 16)
                            for ttext, tcol in gear_tags:
                                gsize = cv2.getTextSize(ttext, cv2.FONT_HERSHEY_SIMPLEX, 0.38, 1)[0]
                                cv2.rectangle(frame, (tag_x, tag_y - 13), (tag_x + gsize[0] + 6, tag_y + 2), (15, 15, 15), -1)
                                cv2.putText(frame, ttext, (tag_x + 3, tag_y - 2), cv2.FONT_HERSHEY_SIMPLEX, 0.38, tcol, 1)
                                tag_x += gsize[0] + 8

                        # 3. Draw item gear detections (Helmet, Vest, Goggles, Gloves, Boots, Fire, Smoke)
                        for det in latest_detections:
                            cname = det.className.lower()
                            if cname == "person":
                                continue  # Already rendered above with rich worker badge

                            bx = int(det.boundingBox.x * w)
                            by = int(det.boundingBox.y * h)
                            bw = int(det.boundingBox.width * w)
                            bh = int(det.boundingBox.height * h)

                            box_color = (40, 200, 80)
                            if "helmet" in cname or "hardhat" in cname:
                                box_color = (255, 220, 0)
                            elif "vest" in cname:
                                box_color = (0, 240, 180)
                            elif "glass" in cname or "goggle" in cname:
                                box_color = (0, 240, 255)
                            elif "fire" in cname:
                                box_color = (0, 0, 255)
                            elif "smoke" in cname:
                                box_color = (0, 140, 255)
                            elif "boot" in cname or "shoe" in cname:
                                box_color = (200, 0, 255)
                            elif "glove" in cname:
                                box_color = (0, 180, 255)

                            cv2.rectangle(frame, (bx, by), (bx + bw, by + bh), box_color, 2)
                            label_str = f"{det.className.upper()} {int(det.confidence * 100)}%"
                            lsize = cv2.getTextSize(label_str, cv2.FONT_HERSHEY_SIMPLEX, 0.38, 1)[0]
                            cv2.rectangle(frame, (bx, max(0, by - 16)), (bx + lsize[0] + 6, by), (20, 20, 20), -1)
                            cv2.putText(frame, label_str, (bx + 3, by - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.38, box_color, 1)

                        # OSD Header on real stream
                        time_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
                        cv2.putText(
                            frame,
                            f"{camera_id} • {camera.get('name', 'IP CAMERA')} [LIVE]",
                            (16, 22),
                            cv2.FONT_HERSHEY_SIMPLEX,
                            0.45,
                            (255, 255, 255),
                            1,
                        )
                        cv2.putText(
                            frame,
                            time_str,
                            (16, 38),
                            cv2.FONT_HERSHEY_SIMPLEX,
                            0.36,
                            (180, 180, 180),
                            1,
                        )

                        # Live OSD banner status
                        if has_worker_violation:
                            cv2.putText(frame, "STATUS: PPE VIOLATION DETECTED", (16, h - 14), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0, 0, 255), 1)
                        else:
                            cv2.putText(frame, "STATUS: ALL COMPLIANT", (16, h - 14), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (40, 220, 80), 1)

                        _, enc = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
                        jpeg_bytes = enc.tobytes()
                    else:
                        time.sleep(0.02)
                else:
                    # Synthetic generator
                    has_violation = (camera_id == "CAM-03" or camera_id == "CAM-05") and (tick % 50 > 20)
                    jpeg_bytes = self._render_synthetic_frame(
                        camera_id=camera["id"],
                        camera_name=camera["name"],
                        zone_id=camera["zoneId"],
                        tick=tick,
                        has_violation=has_violation,
                    )

                if jpeg_bytes:
                    self._latest_frames[camera_id] = jpeg_bytes
                    yield (
                        b"--frame\r\n"
                        b"Content-Type: image/jpeg\r\n\r\n" + jpeg_bytes + b"\r\n"
                    )

                elapsed = time.perf_counter() - start_time
                sleep_needed = max(0.01, frame_interval - elapsed)
                time.sleep(sleep_needed)

        finally:
            pass


stream_manager = StreamManager()
