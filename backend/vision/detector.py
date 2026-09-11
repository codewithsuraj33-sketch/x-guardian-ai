"""Abstract detector contract used by the FastAPI layer."""

from typing import Protocol

from app.models.schemas import VisionFrameResponse


class VisionDetector(Protocol):
    def is_ready(self) -> bool:
        """Return true only when a real model is loaded and usable."""
        ...

    def detect(self, image_bytes: bytes, camera_id: str, source: str = "image") -> VisionFrameResponse:
        """Run inference on one image/frame."""
        ...
