# -*- coding: utf-8 -*-
"""
PyTorch model serving service for DoodleMind.
Loads MobileNetV2 and DenseNet121 transfer learning checkpoints.
"""

import os
import io
import time
import json
import base64
import torch
import numpy as np
from PIL import Image, ImageOps
import torchvision.models as models
from torchvision import transforms
from .translations import get_class_info

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR = os.path.join(BASE_DIR, "models")
CLASS_NAMES_PATH = os.path.join(MODELS_DIR, "class_names.json")

# Preprocessing transform matching training test pipeline (224x224 RGB, ImageNet normalization)
INFERENCE_TRANSFORM = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

class ModelManager:
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"[ModelManager] Using device: {self.device}")

        # Load class names
        with open(CLASS_NAMES_PATH, "r", encoding="utf-8") as f:
            self.class_names = json.load(f)
        self.num_classes = len(self.class_names)
        print(f"[ModelManager] Loaded {self.num_classes} classes.")

        self.models = {}
        self._load_models()

    def _load_models(self):
        # 1. MobileNetV2
        mobilenet_path = os.path.join(MODELS_DIR, "mobilenet_v2_tuberlin.pth")
        if os.path.exists(mobilenet_path):
            print("[ModelManager] Loading MobileNetV2...")
            m_mobilenet = models.mobilenet_v2()
            m_mobilenet.classifier[1] = torch.nn.Linear(m_mobilenet.classifier[1].in_features, self.num_classes)
            checkpoint = torch.load(mobilenet_path, map_location=self.device)
            m_mobilenet.load_state_dict(checkpoint)
            m_mobilenet.to(self.device)
            m_mobilenet.eval()
            self.models["mobilenetv2"] = {
                "id": "mobilenetv2",
                "name": "MobileNetV2",
                "badge": "Fast & Lightweight (~1-2 ms)",
                "params": "3.5M Parameters",
                "val_accuracy": "76.88%",
                "train_accuracy": "92.07%",
                "model": m_mobilenet
            }
            print("[ModelManager] MobileNetV2 loaded successfully.")

        # 2. DenseNet121
        densenet_path = os.path.join(MODELS_DIR, "densenet121_tuberlin.pth")
        if os.path.exists(densenet_path):
            print("[ModelManager] Loading DenseNet121...")
            m_densenet = models.densenet121()
            m_densenet.classifier = torch.nn.Linear(m_densenet.classifier.in_features, self.num_classes)
            checkpoint = torch.load(densenet_path, map_location=self.device)
            m_densenet.load_state_dict(checkpoint)
            m_densenet.to(self.device)
            m_densenet.eval()
            self.models["densenet121"] = {
                "id": "densenet121",
                "name": "DenseNet121",
                "badge": "High Accuracy (~3-5 ms)",
                "params": "8.0M Parameters",
                "val_accuracy": "78.10%",
                "train_accuracy": "91.22%",
                "model": m_densenet
            }
            print("[ModelManager] DenseNet121 loaded successfully.")

    def get_models_info(self):
        info_list = []
        for k, v in self.models.items():
            info_list.append({
                "id": v["id"],
                "name": v["name"],
                "badge": v["badge"],
                "params": v["params"],
                "val_accuracy": v["val_accuracy"],
                "train_accuracy": v["train_accuracy"],
                "device": str(self.device)
            })
        return info_list

    def preprocess_image(self, image_input) -> (Image.Image, bytes, str):
        """
        Ensures white background, crops strokes with padding, centers on 224x224 square,
        and generates the 224x224 input preview.
        """
        if isinstance(image_input, str):
            if image_input.startswith("data:"):
                image_input = image_input.split(",", 1)[1]
            raw_bytes = base64.b64decode(image_input)
            img = Image.open(io.BytesIO(raw_bytes))
        elif isinstance(image_input, bytes):
            raw_bytes = image_input
            img = Image.open(io.BytesIO(raw_bytes))
        else:
            img = image_input
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            raw_bytes = buf.getvalue()

        # Composite transparency over pure white background
        if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
            alpha = img.convert("RGBA").split()[-1]
            bg = Image.new("RGBA", img.size, (255, 255, 255, 255))
            bg.paste(img, mask=alpha)
            img = bg.convert("RGB")
        else:
            img = img.convert("RGB")

        # Grayscale mask to identify strokes
        gray = ImageOps.grayscale(img)
        gray_arr = np.array(gray)

        # Detect ink (darker than 240)
        mask = gray_arr < 240
        if np.any(mask):
            y_indices, x_indices = np.where(mask)
            x_min, x_max = int(np.min(x_indices)), int(np.max(x_indices))
            y_min, y_max = int(np.min(y_indices)), int(np.max(y_indices))

            # Proportional padding
            pad = 24
            w = (x_max - x_min) + pad * 2
            h = (y_max - y_min) + pad * 2
            size = max(w, h, 64)

            # Crop stroke bounding box
            cropped = img.crop((
                max(0, x_min - pad),
                max(0, y_min - pad),
                min(img.width, x_max + pad),
                min(img.height, y_max + pad)
            ))

            # Center on white square canvas
            square_img = Image.new("RGB", (size, size), (255, 255, 255))
            offset_x = (size - cropped.width) // 2
            offset_y = (size - cropped.height) // 2
            square_img.paste(cropped, (offset_x, offset_y))
            processed_img = square_img.resize((224, 224), Image.Resampling.LANCZOS)
        else:
            processed_img = img.resize((224, 224), Image.Resampling.LANCZOS)

        # 224x224 exact input preview
        preview_buf = io.BytesIO()
        processed_img.save(preview_buf, format="PNG")
        preview_b64 = "data:image/png;base64," + base64.b64encode(preview_buf.getvalue()).decode("utf-8")

        save_buf = io.BytesIO()
        processed_img.save(save_buf, format="PNG")
        clean_bytes = save_buf.getvalue()

        return processed_img, clean_bytes, preview_b64

    def predict(self, image_input, model_name: str = "mobilenetv2", top_k: int = 5):
        if model_name not in self.models:
            model_name = "mobilenetv2" if "mobilenetv2" in self.models else list(self.models.keys())[0]

        processed_img, clean_bytes, preview_b64 = self.preprocess_image(image_input)
        tensor_img = INFERENCE_TRANSFORM(processed_img).unsqueeze(0).to(self.device)

        m_obj = self.models[model_name]["model"]
        t0 = time.perf_counter()
        with torch.no_grad():
            logits = m_obj(tensor_img)
            probs = torch.softmax(logits, dim=1)[0]
        elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)

        top_probs, top_indices = torch.topk(probs, top_k)
        predictions = []
        for prob_t, idx_t in zip(top_probs, top_indices):
            cls_raw = self.class_names[idx_t.item()]
            info = get_class_info(cls_raw)
            p = float(prob_t.item())
            pct = round(p * 100, 1)
            predictions.append({
                "class_en": cls_raw,
                "class_name": info["display_name"],
                "class_tr": info["display_name"], # fallback
                "probability": p,
                "percentage": pct,
                "percentage_formatted": f"{pct:.1f}%"
            })
        
        top_prediction = predictions[0] if predictions else None

        # Friendly English feedback
        conf = top_prediction["percentage"] if top_prediction else 0
        if conf >= 75:
            comment = "Pretty confident! Very crisp drawing."
        elif conf >= 40:
            comment = "Most likely this! You can add a few more details."
        elif conf >= 20:
            comment = "Not quite sure yet. Try adding more lines."
        else:
            comment = "A bit confused. Keep sketching!"

        return {
            "model_id": model_name,
            "model_name": self.models[model_name]["name"],
            "top_prediction": top_prediction,
            "predictions": predictions,
            "comment": comment,
            "inference_ms": elapsed_ms,
            "preview_image": preview_b64,
            "clean_bytes": clean_bytes
        }

# Global singleton
model_manager = ModelManager()
