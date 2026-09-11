"""Minimal no-model contract check; does not fabricate inference results."""

from .ppe_detector import create_ppe_detector


def main() -> None:
    detector = create_ppe_detector()
    print({"detector": type(detector).__name__, "engine_ready": detector.is_ready()})


if __name__ == "__main__":
    main()
