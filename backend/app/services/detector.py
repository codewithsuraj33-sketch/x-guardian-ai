"""Compatibility exports for the FastAPI detector dependency."""

from vision.detector import VisionDetector
from vision.ppe_detector import UnavailablePPEDetector, create_ppe_detector

UnavailableVisionDetector = UnavailablePPEDetector
_detector_instance: VisionDetector = create_ppe_detector()


def get_detector() -> VisionDetector:
    return _detector_instance
