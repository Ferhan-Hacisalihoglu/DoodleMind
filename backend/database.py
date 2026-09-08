# -*- coding: utf-8 -*-
"""
SQLite database management for DoodleMind.
Stores sample sketch paths from the dataset and user drawn sketches with prediction logs.
"""

import os
import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Optional, Any
from .translations import get_class_info

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "doodlemind.db")
DATA_DIR = os.path.join(BASE_DIR, "data")
USER_UPLOADS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "user_drawings")
os.makedirs(USER_UPLOADS_DIR, exist_ok=True)

def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes tables and indexes sample images from data directory if needed."""
    conn = get_connection()
    cursor = conn.cursor()

    # Table 1: Sample dataset sketches
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sample_sketches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        category_tr TEXT NOT NULL,
        category_icon TEXT,
        file_path TEXT NOT NULL,
        file_name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_category ON sample_sketches(category)")

    # Table 2: User drawing history and predictions
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS user_drawings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        model_name TEXT NOT NULL,
        image_path TEXT NOT NULL,
        predicted_class TEXT NOT NULL,
        predicted_class_tr TEXT NOT NULL,
        confidence REAL NOT NULL,
        all_predictions_json TEXT,
        inference_ms REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    conn.commit()

    # Check if sample_sketches is populated
    cursor.execute("SELECT COUNT(*) FROM sample_sketches")
    count = cursor.fetchone()[0]

    if count == 0 and os.path.exists(DATA_DIR):
        print(f"[SQLite] Indexing sample sketches from {DATA_DIR}...")
        records = []
        for cat_name in os.listdir(DATA_DIR):
            cat_dir = os.path.join(DATA_DIR, cat_name)
            if not os.path.isdir(cat_dir):
                continue
            info = get_class_info(cat_name)
            cat_tr = info["name_tr"]
            cat_icon = info["icon"]

            for file_name in os.listdir(cat_dir):
                if file_name.lower().endswith(('.png', '.jpg', '.jpeg')):
                    abs_path = os.path.normpath(os.path.join(cat_dir, file_name))
                    records.append((cat_name, cat_tr, cat_icon, abs_path, file_name))

        if records:
            cursor.executemany("""
            INSERT INTO sample_sketches (category, category_tr, category_icon, file_path, file_name)
            VALUES (?, ?, ?, ?, ?)
            """, records)
            conn.commit()
            print(f"[SQLite] Successfully indexed {len(records)} sample sketch locations into SQLite database.")

    conn.close()

def get_sample_by_id(sample_id: int) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sample_sketches WHERE id = ?", (sample_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None

def get_random_sample(category: Optional[str] = None) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    if category:
        cursor.execute("SELECT * FROM sample_sketches WHERE category = ? ORDER BY RANDOM() LIMIT 1", (category,))
    else:
        cursor.execute("SELECT * FROM sample_sketches ORDER BY RANDOM() LIMIT 1")
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None

def get_featured_samples() -> List[Dict[str, Any]]:
    """Returns curated starter items in clean English."""
    featured_cats = [
        "cat", "airplane", "house", "apple", "sun", "fish", "bicycle", "flower with stem", "umbrella", "alarm clock", "car (sedan)", "tree"
    ]
    conn = get_connection()
    cursor = conn.cursor()
    samples = []
    for cat in featured_cats:
        cursor.execute("SELECT * FROM sample_sketches WHERE category = ? ORDER BY RANDOM() LIMIT 1", (cat,))
        row = cursor.fetchone()
        if not row:
            cursor.execute("SELECT * FROM sample_sketches WHERE category LIKE ? ORDER BY RANDOM() LIMIT 1", (f"%{cat}%",))
            row = cursor.fetchone()
        if row:
            d = dict(row)
            info = get_class_info(d["category"])
            d["category_name"] = info["display_name"]
            d["category_tr"] = info["display_name"]
            samples.append(d)
    conn.close()
    return samples

def save_user_drawing(
    model_name: str,
    image_bytes: bytes,
    predicted_class: str,
    predicted_class_tr: str,
    confidence: float,
    all_predictions: List[Dict[str, Any]],
    inference_ms: float
) -> Dict[str, Any]:
    timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    filename = f"draw_{timestamp_str}_{predicted_class.replace(' ', '_')}.png"
    filepath = os.path.normpath(os.path.join(USER_UPLOADS_DIR, filename))

    with open(filepath, "wb") as f:
        f.write(image_bytes)

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO user_drawings (
        model_name, image_path, predicted_class, predicted_class_tr,
        confidence, all_predictions_json, inference_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        model_name,
        filepath,
        predicted_class,
        predicted_class_tr,
        confidence,
        json.dumps(all_predictions, ensure_ascii=False),
        inference_ms
    ))
    conn.commit()
    drawing_id = cursor.lastrowid
    conn.close()

    return {
        "id": drawing_id,
        "image_path": filepath,
        "predicted_class": predicted_class,
        "predicted_class_tr": predicted_class_tr,
        "confidence": confidence,
        "inference_ms": inference_ms
    }

def get_drawing_by_id(drawing_id: int) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM user_drawings WHERE id = ?", (drawing_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        d = dict(row)
        if d.get("all_predictions_json"):
            try:
                d["all_predictions"] = json.loads(d["all_predictions_json"])
            except:
                d["all_predictions"] = []
        return d
    return None

def delete_drawing(drawing_id: int) -> bool:
    drawing = get_drawing_by_id(drawing_id)
    if not drawing:
        return False
    # Remove file from disk if exists
    if os.path.exists(drawing.get("image_path", "")):
        try:
            os.remove(drawing["image_path"])
        except Exception:
            pass
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM user_drawings WHERE id = ?", (drawing_id,))
    conn.commit()
    conn.close()
    return True

def get_drawing_history(limit: int = 100) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM user_drawings ORDER BY id DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    results = []
    for r in rows:
        d = dict(r)
        if d.get("all_predictions_json"):
            try:
                d["all_predictions"] = json.loads(d["all_predictions_json"])
            except:
                d["all_predictions"] = []
        results.append(d)
    return results

def get_stats() -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM sample_sketches")
    sample_count = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(DISTINCT category) FROM sample_sketches")
    category_count = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM user_drawings")
    drawings_count = cursor.fetchone()[0]
    conn.close()
    return {
        "total_sample_sketches": sample_count,
        "total_categories": category_count,
        "total_user_drawings": drawings_count,
        "db_path": DB_PATH
    }
