# -*- coding: utf-8 -*-
"""
DoodleMind Backend Server Runner
Runs FastAPI with Uvicorn on http://127.0.0.1:8000
"""

import sys
import os

# Ensure UTF-8 output on Windows console
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import uvicorn

if __name__ == "__main__":
    print("=" * 60)
    print("  [DoodleMind] AI Backend (PyTorch + FastAPI + SQLite)")
    print("  Serving at: http://localhost:8000")
    print("  API Docs at: http://localhost:8000/docs")
    print("=" * 60)
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=False)
