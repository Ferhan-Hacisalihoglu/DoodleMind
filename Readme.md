# DoodleMind

![Python](https://img.shields.io/badge/Python-3.13-3776AB?logo=python&logoColor=white)
![PyTorch](https://img.shields.io/badge/PyTorch-2.0-EE4C2C?logo=pytorch&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)

> Interactive Sketch-Recognition AI — PyTorch (MobileNetV2 & DenseNet121) + FastAPI (Backend) + Dockerized React (Frontend)

The user draws on a canvas, and the AI model predicts the category in real time with confidence scores, bounding-box centering, and a 224 × 224 tensor input preview.

---

## Stack
- **AI & Training:** PyTorch 2.13.0 + CUDA 12.6, transfer learning only:
  - **MobileNetV2** (Inverted residuals, ~3.5M parameters, 10.4 MB checkpoint)
  - **DenseNet121** (Dense connectivity, ~8.0M parameters, 29.5 MB checkpoint)
- **Training Hardware:** NVIDIA GeForce RTX 3060 Laptop GPU (6 GB GDDR6 VRAM)
  - Preloaded in-memory RAM caching (`CachedSketchDataset`, ~133 MB RAM) for zero-disk-latency training.
- **Backend:** Python FastAPI + Uvicorn + SQLite (`backend/doodlemind.db`)
  - Runs natively on host PC with GPU acceleration.
  - Serves inference (`POST /api/predict`), sample catalog (`GET /api/samples`), and user gallery endpoints (`GET/POST/DELETE /api/drawings`).
- **Frontend:** React 18 + Vite + Lucide Icons + Canvas-Confetti
  - Runs entirely inside a Docker container (port 3000); requires no Node.js or npm packages installed on the host PC.
- **Database:** SQLite 3 (`backend/doodlemind.db`)
  - `sample_sketches`: 20,000 indexed TU-Berlin sketch file paths and categories.
  - `user_drawings`: Saved user sketches with predicted labels, confidence, inference latency, and image disk paths.

---

## Dataset
- **TU-Berlin Sketch — sketches only** (20,000 hand-drawn sketches, 250 categories, 80 sketches per class)
- Photos/pairs excluded — classification on hand-drawn sketches only.
- Layout: one folder per class under `data/` (e.g. `data/cat/*.png`)
- Split: 75% train (15,000 sketches) / 25% test (5,000 sketches) (stratified, `random_state=42`)
- Input dimensions: 224 × 224 RGB, ImageNet normalization (mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
- Data augmentation: RandomHorizontalFlip, RandomAffine (±45°, translate 0.1, scale 0.85–1.15, fill 255), RandomPerspective (scale 0.2, p=0.5), ColorJitter (0.25), RandomErasing (p=0.25)

---

## Models & Benchmark Results
1. **MobileNetV2** (`train/mobilenetv2.py`):
   - Checkpoint: `models/mobilenet_v2_tuberlin.pth` (10.4 MB)
   - Fine-tuning: Last 9 residual blocks + linear classification head (1280 → 250).
   - Peak convergence (Epoch 57/60): **Train Acc: 77.67% (loss 0.7740) / Test Acc: 72.40% (loss 1.0713)** (Peak Test Acc: 72.54% at Ep 56; Final Ep 60: Train Acc 78.13%)
   - Completed all 60 epochs without overfitting triggers.
   - Inference latency on RTX 3060: **~1.1 - 1.8 ms**
2. **DenseNet121** (`train/densenet121.py`):
   - Checkpoint: `models/densenet121_tuberlin.pth` (29.5 MB)
   - Fine-tuning: `denseblock1`, `transition1`, `denseblock2`, `transition2`, `denseblock3`, `transition3`, `denseblock4`, `norm5` + linear classifier (1024 → 250).
   - Peak convergence (Epoch 20/60, Early Stop Ep 24): **Best Val Loss: 0.8938 (Val Acc: 75.92%) / Peak Test Acc: 76.52% (Train Acc: 88.09%)**
   - Early stopping triggered at Epoch 24 to guard against generalization gap.
   - Inference latency on RTX 3060: **~2.8 - 4.5 ms**

---

## Folder Layout
```
DoodleMind/
├── Readme.md                 # Project documentation & architecture overview
├── docker-compose.yml       # Docker Compose setup for frontend container
├── requirements.txt         # Python dependencies for backend
├── run_backend.py           # Backend startup script (FastAPI on port 8000)
├── data/                    # TU-Berlin sketches (250 category folders, 20,000 images)
├── models/
│   ├── class_names.json     # 250 category labels in English
│   ├── mobilenet_v2_tuberlin.pth # Trained MobileNetV2 checkpoint
│   └── densenet121_tuberlin.pth  # Trained DenseNet121 checkpoint
├── train/
│   ├── mobilenetv2.py       # MobileNetV2 fine-tuning training script
│   └── densenet121.py       # DenseNet121 fine-tuning training script
├── backend/
│   ├── main.py              # FastAPI REST endpoints & CORS
│   ├── models_service.py    # PyTorch model serving & 224x224 tensor preprocessing
│   ├── database.py          # SQLite database schema, 20k indexer & drawing logs
│   ├── translations.py      # Clean English category names formatting
│   ├── doodlemind.db        # SQLite database file
│   └── user_drawings/       # Saved user sketches stored as PNG files
└── frontend/
    ├── Dockerfile           # Docker container definition (Node 20 Alpine)
    ├── package.json         # React 18, Vite, Lucide Icons, Canvas-Confetti
    ├── vite.config.js       # Vite build & development server config
    ├── index.html           # Single-page application entry HTML
    └── src/
        ├── main.jsx         # React root mounter
        ├── App.jsx          # Application router & core layout
        ├── App.css          # Design system & responsive styles
        ├── index.css        # Global CSS variables & typography tokens
        ├── components/
        │   ├── Header.jsx           # DoodleMind logo, nav tabs & GPU badge
        │   ├── Canvas.jsx           # Drawing canvas, pointer events & Save button
        │   ├── PredictionCard.jsx   # Model switcher, predictions & 224x224 preview
        │   ├── SamplesBar.jsx       # Quick starter gallery from SQLite
        │   ├── MyGalleryPage.jsx    # Dedicated user drawing gallery & deletion
        │   ├── TrainingLogPage.jsx  # Rich training logs, curves & RTX 3060 specs
        │   └── ModelCardPage.jsx    # Architecture layers & preprocessing pipeline
        └── utils/
            └── api.js               # API client calling http://localhost:8000
```

---

## Key Features
1. **Interactive Drawing Canvas:** High-DPI canvas with `PointerEvents` capture, stroke thickness, eraser, undo (`Ctrl+Z`), clear, and unconstrained edge-to-edge drawing.
2. **Model Selection:** Instant switching between **MobileNetV2** (Fast • 3.5M) and **DenseNet121** (High Accuracy • 8.0M).
3. **224 × 224 Preprocessing:** Bounding-box stroke detection, aspect-ratio padding, centering, and ImageNet normalization with live "What I see" preview.
4. **On-Demand User Gallery:** Strokes are not saved automatically. The user clicks **"Save Drawing"** to persist their favorite doodles and predictions in SQLite; managed via the dedicated **"My Gallery"** page.
5. **Dedicated Technical Pages:**
   - **Training Log:** Detailed epoch checkpoints, loss/accuracy curves, augmentation breakdown, and RTX 3060 6GB hardware spotlight.
   - **Model Card:** Layer architectures, fine-tuning strategy, SQLite schema, and tensor pipeline.
6. **Starter Gallery ("Where to start?"):** 12 curated test sketch categories loaded directly from SQLite onto the canvas, plus random sketch picker.

---

## Screenshots

<table>
  <tr>
    <td width="50%" align="center">
      <b>Interactive Canvas & Real-time Inference</b><br/>
      <img src="https://github.com/user-attachments/assets/6f98aec2-d729-4e4a-852a-212033f04d18" alt="Interactive Canvas & Real-time Inference" />
    </td>
    <td width="50%" align="center">
      <b>Sample Catalog & Predictions</b><br/>
      <img src="https://github.com/user-attachments/assets/44f519fc-caa9-49da-81ac-4da32d07d8d2" alt="Sample Catalog & Predictions" />
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <b>Training Logs & Hardware Specs</b><br/>
      <img width="1919" height="2451" alt="Screenshot 2026-09-08 at 21-52-53 karala  — Neural Sketchpad (PyTorch   FastAPI)" src="https://github.com/user-attachments/assets/1f851567-94d0-4949-b914-fae4a41d3248" />
    </td>
    <td width="50%" align="center">
      <b>Model Card & Preprocessing Pipeline</b><br/>
      <img src="https://github.com/user-attachments/assets/ade5cc49-036b-45a5-97c9-04a155a73768" alt="Model Card & Preprocessing Pipeline" />
    </td>
  </tr>
</table>


---

## How to Run

### 1. Start Backend (Host PC)
Ensure Python dependencies are installed (`pip install -r requirements.txt`):
```bash
python run_backend.py
```
- API is live at: `http://localhost:8000`
- Interactive Swagger docs at: `http://localhost:8000/docs`

### 2. Start Frontend (Docker Container)
Run with Docker Compose (no local Node.js required):
```bash
docker compose up -d
```
- Web Application is live at: `http://localhost:3000`
- To stop the frontend: `docker compose down`
