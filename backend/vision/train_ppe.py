"""Explicit opt-in training entry point for a PPE checkpoint.

This script never runs during application startup. Review resources and
licensing, then invoke it deliberately after installing the vision extras.
"""

import argparse


def main() -> None:
    parser = argparse.ArgumentParser(description="Train a PPE detector explicitly.")
    parser.add_argument("--data", required=True, help="Path to a reviewed PPE dataset YAML")
    parser.add_argument("--model", default="yolo26n.pt", help="Base model checkpoint")
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--device", default="cpu")
    args = parser.parse_args()

    try:
        from ultralytics import YOLO
    except ImportError as error:
        raise SystemExit("Install the reviewed vision dependencies before training: ultralytics and a compatible PyTorch build.") from error

    model = YOLO(args.model)
    model.train(data=args.data, epochs=args.epochs, imgsz=args.imgsz, device=args.device)


if __name__ == "__main__":
    main()
