# ─────────────────────────────────────────────
# X-Guardian — Industrial Fire & Smoke Computer Vision Detector
# Real-time multi-spectral chrominance, contour analysis & plume haze dispersion
# ─────────────────────────────────────────────

from dataclasses import dataclass
from typing import Optional, Tuple, List
import cv2
import numpy as np


@dataclass
class FireDetectionResult:
    has_fire: bool = False
    confidence: float = 0.0
    bbox: Optional[Tuple[float, float, float, float]] = None  # (x, y, w, h) normalized
    area_pixels: int = 0


@dataclass
class SmokeDetectionResult:
    has_smoke: bool = False
    confidence: float = 0.0
    density: float = 0.0  # 0 to 100%
    bbox: Optional[Tuple[float, float, float, float]] = None  # (x, y, w, h) normalized
    area_pixels: int = 0


@dataclass
class HazardAnalysisResult:
    fire: FireDetectionResult
    smoke: SmokeDetectionResult


class IndustrialHazardDetector:
    """
    High-performance optical hazard analyzer for industrial surveillance.
    Combines RGB-HSV spectral thresholding, flame core intensity,
    and smoke plume gradient dissipation for sub-10ms inference.
    """

    def __init__(
        self,
        min_flame_pixels: int = 200,
        min_smoke_pixels: int = 600,
        fire_conf_thresh: float = 0.65,
        smoke_conf_thresh: float = 0.60,
    ):
        self.min_flame_pixels = min_flame_pixels
        self.min_smoke_pixels = min_smoke_pixels
        self.fire_conf_thresh = fire_conf_thresh
        self.smoke_conf_thresh = smoke_conf_thresh

    def detect(
        self,
        bgr_image: np.ndarray,
        person_boxes: Optional[List[List[float]]] = None,
    ) -> HazardAnalysisResult:
        if bgr_image is None or bgr_image.size == 0:
            return HazardAnalysisResult(
                fire=FireDetectionResult(),
                smoke=SmokeDetectionResult(),
            )

        h, w = bgr_image.shape[:2]

        # ─────────────────────────────────────────────
        # 1. Real-time Fire / Flame Detection
        # ─────────────────────────────────────────────
        fire_res = self._detect_flame(bgr_image, w, h, person_boxes)

        # ─────────────────────────────────────────────
        # 2. Real-time Smoke Plume Detection
        # ─────────────────────────────────────────────
        smoke_res = self._detect_smoke(bgr_image, w, h, flame_active=fire_res.has_fire)

        return HazardAnalysisResult(fire=fire_res, smoke=smoke_res)

    def _detect_flame(
        self,
        bgr: np.ndarray,
        w: int,
        h: int,
        person_boxes: Optional[List[List[float]]] = None,
    ) -> FireDetectionResult:
        """
        Flame detection using fused HSV + RGB chrominance rules.
        Excludes yellow hard hats and high-vis vests via strict red dominance and person masking.
        """
        scale = 1.0
        proc_img = bgr
        if max(w, h) > 960:
            scale = 640.0 / max(w, h)
            proc_img = cv2.resize(bgr, (int(w * scale), int(h * scale)))

        proc_h, proc_w = proc_img.shape[:2]
        hsv = cv2.cvtColor(proc_img, cv2.COLOR_BGR2HSV)
        b, g, r = cv2.split(proc_img)

        # 1. Strict Fire Chrominance: Red is distinctly dominant over Green & Blue
        # Flames have R >= 215, (R - G) >= 28, (R - B) >= 70
        # Hue is restricted to Red/Deep Orange [0..22] or [172..180], strictly omitting yellow (>22)
        r_int = r.astype(np.int16)
        g_int = g.astype(np.int16)
        b_int = b.astype(np.int16)

        flame_mask = (
            (r >= 215)
            & ((r_int - g_int) >= 28)
            & ((r_int - b_int) >= 70)
            & (((hsv[:, :, 0] <= 22) | (hsv[:, :, 0] >= 172)))
            & (hsv[:, :, 1] >= 110)
            & (hsv[:, :, 2] >= 175)
        ).astype(np.uint8) * 255

        # Morphological opening to eliminate isolated noise
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        flame_mask = cv2.morphologyEx(flame_mask, cv2.MORPH_OPEN, kernel)

        # 2. Exclude Person Vest / Clothing Regions if worker boxes detected
        if person_boxes:
            for pbox in person_boxes:
                px1 = max(0, int(pbox[0] * scale))
                py1 = max(0, int(pbox[1] * scale))
                px2 = min(proc_w, int(pbox[2] * scale))
                py2 = min(proc_h, int(pbox[3] * scale))
                flame_mask[py1:py2, px1:px2] = 0

        contours, _ = cv2.findContours(flame_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        best_area = 0
        best_bbox = None
        scaled_min = max(int(self.min_flame_pixels * (scale * scale)), int(proc_w * proc_h * 0.00035))

        for c in contours:
            area = cv2.contourArea(c)
            if area >= scaled_min:
                bx, by, bw, bh = cv2.boundingRect(c)
                # Flames rise vertically and flicker (aspect ratio bh/bw >= 0.65)
                aspect = bh / max(bw, 1)
                if aspect >= 0.65 and area > best_area:
                    best_area = area
                    if scale != 1.0:
                        bx, by, bw, bh = int(bx / scale), int(by / scale), int(bw / scale), int(bh / scale)
                    best_bbox = (
                        round(max(0.0, bx / w), 4),
                        round(max(0.0, by / h), 4),
                        round(min(1.0, bw / w), 4),
                        round(min(1.0, bh / h), 4),
                    )

        if best_bbox and best_area >= scaled_min:
            norm_area_ratio = min(1.0, best_area / (w * h * 0.04 * scale * scale))
            conf = min(0.98, max(0.74, 0.76 + norm_area_ratio * 0.22))
            return FireDetectionResult(
                has_fire=True,
                confidence=round(conf, 3),
                bbox=best_bbox,
                area_pixels=int(best_area / (scale * scale)),
            )

        return FireDetectionResult(has_fire=False, confidence=0.0, bbox=None, area_pixels=0)

    def _detect_smoke(
        self,
        bgr: np.ndarray,
        w: int,
        h: int,
        flame_active: bool = False,
    ) -> SmokeDetectionResult:
        """
        Smoke plume detection using low color variance (grey/white) and amorphous morphology.
        Utilizes Laplacian edge variance to distinguish true smoke haze from textured solid floors/walls.
        """
        scale = 1.0
        proc_img = bgr
        if max(w, h) > 640:
            scale = 480.0 / max(w, h)
            proc_img = cv2.resize(bgr, (int(w * scale), int(h * scale)))

        proc_h, proc_w = proc_img.shape[:2]
        hsv = cv2.cvtColor(proc_img, cv2.COLOR_BGR2HSV)
        b, g, r = cv2.split(proc_img)

        # Smoke characteristic: Low Saturation (< 38), Medium to High Brightness (110 to 235)
        # Low RGB channel variance (|R-G| < 14, |G-B| < 14)
        s_channel = hsv[:, :, 1]
        v_channel = hsv[:, :, 2]

        diff_rg = cv2.absdiff(r, g)
        diff_gb = cv2.absdiff(g, b)

        smoke_mask = (
            (s_channel < 38)
            & (v_channel > 110)
            & (v_channel < 235)
            & (diff_rg < 14)
            & (diff_gb < 14)
        ).astype(np.uint8) * 255

        # Morphological filter to eliminate noise
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9))
        smoke_mask = cv2.morphologyEx(smoke_mask, cv2.MORPH_OPEN, kernel)

        contours, _ = cv2.findContours(smoke_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        best_area = 0
        best_bbox = None
        scaled_min = max(int(self.min_smoke_pixels * (scale * scale)), int(proc_w * proc_h * 0.002))

        proc_gray = cv2.cvtColor(proc_img, cv2.COLOR_BGR2GRAY)

        for c in contours:
            area = cv2.contourArea(c)
            if area >= scaled_min:
                bx, by, bw, bh = cv2.boundingRect(c)
                # A smoke plume rises or floats: centroid cannot be stuck purely at ground level unless fire is active
                centroid_y = by + bh / 2
                if not flame_active and centroid_y > proc_h * 0.78:
                    continue

                # Texture analysis: Smoke is amorphous with very low edge variance (Laplacian < 45)
                crop_gray = proc_gray[by:by+bh, bx:bx+bw]
                if crop_gray.size > 0:
                    laplacian_var = float(cv2.Laplacian(crop_gray, cv2.CV_64F).var())
                    if laplacian_var < 45.0 and area > best_area:
                        best_area = area
                        if scale != 1.0:
                            bx, by, bw, bh = int(bx / scale), int(by / scale), int(bw / scale), int(bh / scale)
                        best_bbox = (
                            round(max(0.0, bx / w), 4),
                            round(max(0.0, by / h), 4),
                            round(min(1.0, bw / w), 4),
                            round(min(1.0, bh / h), 4),
                        )

        if best_bbox and best_area >= scaled_min:
            density = min(98.5, max(35.0, (best_area / (w * h * 0.12 * scale * scale)) * 100))
            conf = min(0.95, max(0.68, 0.70 + (density / 100.0) * 0.24))
            return SmokeDetectionResult(
                has_smoke=True,
                confidence=round(conf, 3),
                density=round(density, 1),
                bbox=best_bbox,
                area_pixels=int(best_area / (scale * scale)),
            )

        return SmokeDetectionResult(has_smoke=False, confidence=0.0, density=0.0, bbox=None, area_pixels=0)
