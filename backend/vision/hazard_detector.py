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
        min_flame_pixels: int = 800,
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
        smoke_res = self._detect_smoke(
            bgr_image,
            w,
            h,
            flame_active=fire_res.has_fire,
            flame_bbox=fire_res.bbox,
        )

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

        # Group contiguous burning flame tongues (pallets, machinery, open flame)
        flame_grouped = cv2.dilate(flame_mask, cv2.getStructuringElement(cv2.MORPH_RECT, (11, 11)))
        contours, _ = cv2.findContours(flame_grouped, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        scaled_min = max(int(self.min_flame_pixels * (scale * scale)), int(proc_w * proc_h * 0.002))
        valid_flames = []
        total_flame_area = 0

        for c in contours:
            area = cv2.contourArea(c)
            if area >= scaled_min:
                bx, by, bw, bh = cv2.boundingRect(c)
                valid_flames.append((bx, by, bw, bh, area))
                total_flame_area += area

        if valid_flames:
            min_bx = min(f[0] for f in valid_flames)
            min_by = min(f[1] for f in valid_flames)
            max_bx = max(f[0] + f[2] for f in valid_flames)
            max_by = max(f[1] + f[3] for f in valid_flames)

            bw_comb = max_bx - min_bx
            bh_comb = max_by - min_by
            if scale != 1.0:
                min_bx = int(min_bx / scale)
                min_by = int(min_by / scale)
                bw_comb = int(bw_comb / scale)
                bh_comb = int(bh_comb / scale)

            best_bbox = (
                round(max(0.0, min_bx / w), 4),
                round(max(0.0, min_by / h), 4),
                round(min(1.0, bw_comb / w), 4),
                round(min(1.0, bh_comb / h), 4),
            )
            norm_area_ratio = min(1.0, total_flame_area / (w * h * 0.04 * scale * scale))
            conf = min(0.98, max(0.76, 0.78 + norm_area_ratio * 0.20))
            return FireDetectionResult(
                has_fire=True,
                confidence=round(conf, 3),
                bbox=best_bbox,
                area_pixels=int(total_flame_area / (scale * scale)),
            )

        return FireDetectionResult(has_fire=False, confidence=0.0, bbox=None, area_pixels=0)

    def _detect_smoke(
        self,
        bgr: np.ndarray,
        w: int,
        h: int,
        flame_active: bool = False,
        flame_bbox: Optional[Tuple[float, float, float, float]] = None,
    ) -> SmokeDetectionResult:
        """
        Smoke plume detection supporting both dark combustion soot plumes
        and diffuse white/grey smoke haze columns.
        """
        scale = 1.0
        proc_img = bgr
        if max(w, h) > 640:
            scale = 480.0 / max(w, h)
            proc_img = cv2.resize(bgr, (int(w * scale), int(h * scale)))

        proc_h, proc_w = proc_img.shape[:2]
        hsv = cv2.cvtColor(proc_img, cv2.COLOR_BGR2HSV)
        b, g, r = cv2.split(proc_img)

        s_channel = hsv[:, :, 1]
        v_channel = hsv[:, :, 2]
        if not flame_active:
            return SmokeDetectionResult(has_smoke=False, confidence=0.0, density=0.0, bbox=None, area_pixels=0)

        diff_rg = cv2.absdiff(r, g)
        diff_gb = cv2.absdiff(g, b)

        # 1. Dark industrial soot / combustion smoke (black & dark grey plume)
        dark_smoke = (
            (s_channel < 95)
            & (v_channel >= 18)
            & (v_channel <= 135)
            & (diff_rg < 35)
            & (diff_gb < 35)
        )

        # 2. White/grey haze plume
        light_smoke = (
            (s_channel < 45)
            & (v_channel > 135)
            & (v_channel < 240)
            & (diff_rg < 22)
            & (diff_gb < 22)
        )

        smoke_raw = ((dark_smoke | light_smoke).astype(np.uint8)) * 255

        # Anchor smoke detection to the plume column rising from the active fire
        if flame_bbox:
            fx, fy, fw, fh = flame_bbox
            px1 = max(0, int((fx - 0.16) * proc_w))
            px2 = min(proc_w, int((fx + fw + 0.16) * proc_w))
            py2 = min(proc_h, int((fy + fh * 0.45) * proc_h))
            py1 = max(0, int(0.02 * proc_h))
            mask_focus = np.zeros_like(smoke_raw)
            mask_focus[py1:py2, px1:px2] = 255
            smoke_raw = cv2.bitwise_and(smoke_raw, mask_focus)

        kernel_smoke = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
        smoke_clean = cv2.morphologyEx(smoke_raw, cv2.MORPH_CLOSE, kernel_smoke)
        smoke_clean = cv2.morphologyEx(smoke_clean, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7)))

        contours, _ = cv2.findContours(smoke_clean, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        scaled_min = (
            max(int(self.min_smoke_pixels * (scale * scale)), int(proc_w * proc_h * 0.005))
            if flame_active
            else max(int(self.min_smoke_pixels * (scale * scale) * 2), int(proc_w * proc_h * 0.04))
        )

        best_area = 0
        best_bbox = None

        for c in contours:
            area = cv2.contourArea(c)
            if area >= scaled_min and area > best_area:
                bx, by, bw, bh = cv2.boundingRect(c)
                centroid_y = by + bh / 2
                if not flame_active and centroid_y > proc_h * 0.60:
                    continue
                best_area = area
                if scale != 1.0:
                    bx_orig = int(bx / scale)
                    by_orig = int(by / scale)
                    bw_orig = int(bw / scale)
                    bh_orig = int(bh / scale)
                else:
                    bx_orig, by_orig, bw_orig, bh_orig = bx, by, bw, bh

                best_bbox = (
                    round(max(0.0, bx_orig / w), 4),
                    round(max(0.0, by_orig / h), 4),
                    round(min(1.0, bw_orig / w), 4),
                    round(min(1.0, bh_orig / h), 4),
                )

        if best_bbox and best_area >= scaled_min:
            density = min(98.5, max(38.0, (best_area / (proc_w * proc_h * 0.14)) * 100))
            conf = min(0.96, max(0.72, 0.74 + (density / 100.0) * 0.22))
            return SmokeDetectionResult(
                has_smoke=True,
                confidence=round(conf, 3),
                density=round(density, 1),
                bbox=best_bbox,
                area_pixels=int(best_area / (scale * scale)),
            )

        return SmokeDetectionResult(has_smoke=False, confidence=0.0, density=0.0, bbox=None, area_pixels=0)
