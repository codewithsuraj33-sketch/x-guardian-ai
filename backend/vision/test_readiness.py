"""Minimal no-model contract check; does not fabricate inference results."""

import sys
from pathlib import Path

# Ensure backend root is in sys.path
backend_dir = Path(__file__).resolve().parents[1]
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

try:
    from vision.ppe_detector import create_ppe_detector
except ImportError:
    from ppe_detector import create_ppe_detector



def main() -> None:
    detector = create_ppe_detector()
    print({"detector": type(detector).__name__, "engine_ready": detector.is_ready()})


if __name__ == "__main__":
    main()
