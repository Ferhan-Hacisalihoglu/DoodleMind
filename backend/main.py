# -*- coding: utf-8 -*-
"""
FastAPI application entry point for DoodleMind.
Serves sketch prediction, SQLite sample sketch catalogue, and user drawing gallery.
"""

import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from .database import (
    init_db,
    get_featured_samples,
    get_random_sample,
    get_sample_by_id,
    save_user_drawing,
    get_drawing_history,
    get_drawing_by_id,
    delete_drawing,
    get_stats
)
from .models_service import model_manager
from .translations import get_class_info

app = FastAPI(
    title="DoodleMind API",
    description="Sketch recognition API running on host PC with PyTorch and SQLite",
    version="1.0.0"
)

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TRAINING_HARDWARE = "NVIDIA GeForce RTX 3060 Laptop GPU (6 GB VRAM)"

@app.on_event("startup")
def startup_event():
    print("[FastAPI] Initializing SQLite database...")
    init_db()
    print("[FastAPI] Ready to serve DoodleMind predictions!")

class PredictRequest(BaseModel):
    image: str # base64 data url
    model: Optional[str] = "mobilenetv2"
    save_drawing: Optional[bool] = False # Do NOT save automatically; only save on user demand!

class SaveDrawingRequest(BaseModel):
    image: str
    model: Optional[str] = "mobilenetv2"

@app.get("/api/health")
def health_check():
    return {
        "status": "online",
        "app_name": "DoodleMind",
        "device": str(model_manager.device),
        "training_hardware": TRAINING_HARDWARE,
        "available_models": list(model_manager.models.keys())
    }

@app.get("/api/models")
def get_models():
    return {
        "models": model_manager.get_models_info(),
        "training_hardware": TRAINING_HARDWARE,
        "default": "mobilenetv2"
    }

@app.get("/api/classes")
def get_classes():
    classes_list = []
    for cls_en in model_manager.class_names:
        info = get_class_info(cls_en)
        classes_list.append(info)
    return {
        "count": len(classes_list),
        "classes": classes_list
    }

@app.post("/api/predict")
def predict_sketch(req: PredictRequest):
    if not req.image:
        raise HTTPException(status_code=400, detail="Image data is required.")
    
    try:
        result = model_manager.predict(req.image, model_name=req.model)
        
        saved_record = None
        if req.save_drawing and "clean_bytes" in result:
            top_p = result.get("top_prediction")
            if top_p:
                all_preds = result.get("predictions", [])
                saved_record = save_user_drawing(
                    model_name=req.model,
                    image_bytes=result["clean_bytes"],
                    predicted_class=top_p["class_en"],
                    predicted_class_tr=top_p["class_name"],
                    confidence=top_p["probability"],
                    all_predictions=all_preds,
                    inference_ms=result.get("inference_ms", 0.0)
                )

        result.pop("clean_bytes", None)
        result["saved_record"] = saved_record
        return result

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/drawings/save")
def save_drawing_endpoint(req: SaveDrawingRequest):
    """Explicit endpoint called when user clicks 'Save to Gallery' button."""
    if not req.image:
        raise HTTPException(status_code=400, detail="Image data is required.")
    
    result = model_manager.predict(req.image, model_name=req.model)
    top_p = result.get("top_prediction")
    if not top_p or "clean_bytes" not in result:
        raise HTTPException(status_code=500, detail="Could not process image for saving.")
    
    saved_record = save_user_drawing(
        model_name=req.model,
        image_bytes=result["clean_bytes"],
        predicted_class=top_p["class_en"],
        predicted_class_tr=top_p["class_name"],
        confidence=top_p["probability"],
        all_predictions=result.get("predictions", []),
        inference_ms=result.get("inference_ms", 0.0)
    )
    saved_record["image_url"] = f"/api/drawings/image/{saved_record['id']}"
    return {
        "success": True,
        "drawing": saved_record
    }

@app.get("/api/drawings")
def get_user_drawings():
    """Returns all sketches manually saved by the user from SQLite."""
    drawings = get_drawing_history(limit=100)
    for d in drawings:
        d["image_url"] = f"/api/drawings/image/{d['id']}"
    return {
        "count": len(drawings),
        "drawings": drawings
    }

@app.get("/api/drawings/image/{drawing_id}")
def serve_user_drawing_image(drawing_id: int):
    drawing = get_drawing_by_id(drawing_id)
    if not drawing:
        raise HTTPException(status_code=404, detail="Drawing not found.")
    
    file_path = drawing.get("image_path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Image file not found on disk.")
    
    return FileResponse(file_path, media_type="image/png")

@app.delete("/api/drawings/{drawing_id}")
def remove_user_drawing(drawing_id: int):
    success = delete_drawing(drawing_id)
    if not success:
        raise HTTPException(status_code=404, detail="Drawing not found or already deleted.")
    return {"success": True, "deleted_id": drawing_id}

@app.get("/api/samples")
def get_samples():
    featured = get_featured_samples()
    for item in featured:
        item["image_url"] = f"/api/samples/image/{item['id']}"
    return {
        "samples": featured
    }

@app.get("/api/samples/random")
def get_random_sketch(category: Optional[str] = None):
    sample = get_random_sample(category)
    if not sample:
        raise HTTPException(status_code=404, detail="No sample found.")
    sample["image_url"] = f"/api/samples/image/{sample['id']}"
    return sample

@app.get("/api/samples/image/{sample_id}")
def serve_sample_image(sample_id: int):
    sample = get_sample_by_id(sample_id)
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found in SQLite database.")
    
    file_path = sample["file_path"]
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Image file does not exist at {file_path}")
    
    return FileResponse(file_path, media_type="image/png")

@app.get("/api/stats")
def get_application_stats():
    stats = get_stats()
    stats["models"] = model_manager.get_models_info()
    stats["device"] = str(model_manager.device)
    stats["training_hardware"] = TRAINING_HARDWARE
    return stats
