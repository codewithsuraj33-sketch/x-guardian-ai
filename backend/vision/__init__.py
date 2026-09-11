"""Model-independent vision engine interfaces and PPE detector adapters."""

from .detector import VisionDetector
from .ppe_detector import UltralyticsPPEDetector

__all__ = ["VisionDetector", "UltralyticsPPEDetector"]
