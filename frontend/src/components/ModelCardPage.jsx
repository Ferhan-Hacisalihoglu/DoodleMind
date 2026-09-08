import React from 'react';
import { ArrowLeft, Database, Layers, Box, Cpu, Flame, CheckCircle, ShieldCheck, Activity, Terminal } from 'lucide-react';

export default function ModelCardPage({ onBackToCanvas, dbStats }) {
  return (
    <div className="full-page-view">
      <div className="page-top-bar">
        <button className="back-btn" onClick={onBackToCanvas}>
          <ArrowLeft size={16} />
          <span>Back to Drawing Board</span>
        </button>
      </div>

      <div className="page-header">
        <div className="header-badge-row">
          <span className="pill-badge gpu-pill">
            <Cpu size={14} /> NVIDIA GeForce RTX 3060 Mobile (6 GB VRAM)
          </span>
          <span className="pill-badge sqlite-pill">
            <Database size={14} /> SQLite Persistent Storage
          </span>
        </div>
        <h1 className="page-title">Model Card & Deep Architecture</h1>
        <p className="page-subtitle">
          Architectural deep-dive, fine-tuning strategy, SQLite schema, and end-to-end tensor preprocessing in DoodleMind.
        </p>
      </div>

      {/* Architecture Cards Grid */}
      <div className="arch-detail-grid">
        {/* MobileNetV2 */}
        <div className="arch-detail-card">
          <div className="arch-header-row">
            <div className="arch-icon-bubble"><Layers size={22} /></div>
            <div>
              <h2 className="arch-name">MobileNetV2</h2>
              <span className="arch-sub">Google (Sandler et al.) Transfer Learning</span>
            </div>
          </div>
          <p className="arch-description">
            Constructed with <strong>inverted residual blocks</strong> and linear bottlenecks. Standard 3×3 convolutions are factored into a 3×3 depthwise convolution followed by a 1×1 pointwise projection, yielding ultra-low floating-point operations (FLOPs).
          </p>

          <div className="arch-spec-list">
            <div className="arch-spec-item">
              <span className="spec-lbl">Input Tensor:</span>
              <span className="spec-val"><code>[batch, 3, 224, 224]</code></span>
            </div>
            <div className="arch-spec-item">
              <span className="spec-lbl">Feature Channels:</span>
              <span className="spec-val">1280 output dimensions</span>
            </div>
            <div className="arch-spec-item">
              <span className="spec-lbl">Classifier Layer:</span>
              <span className="spec-val"><code>nn.Linear(1280, 250)</code></span>
            </div>
            <div className="arch-spec-item">
              <span className="spec-lbl">Fine-Tuning Strategy:</span>
              <span className="spec-val">Frozen base features; unfrozen last 6 residual blocks + linear classifier</span>
            </div>
            <div className="arch-spec-item">
              <span className="spec-lbl">Weight File Size:</span>
              <span className="spec-val">10.4 MB (3.5M parameters)</span>
            </div>
          </div>
        </div>

        {/* DenseNet121 */}
        <div className="arch-detail-card primary-border">
          <div className="arch-header-row">
            <div className="arch-icon-bubble purple"><Layers size={22} /></div>
            <div>
              <h2 className="arch-name">DenseNet121</h2>
              <span className="arch-sub">Huang et al. (Dense Convolutional Network)</span>
            </div>
          </div>
          <p className="arch-description">
            Connects each layer to every other layer in a feed-forward fashion via <strong>feature concatenation</strong>. By reusing features at all levels, DenseNet learns extremely discriminative representations of hand-drawn strokes with zero gradient attenuation.
          </p>

          <div className="arch-spec-list">
            <div className="arch-spec-item">
              <span className="spec-lbl">Input Tensor:</span>
              <span className="spec-val"><code>[batch, 3, 224, 224]</code></span>
            </div>
            <div className="arch-spec-item">
              <span className="spec-lbl">Feature Channels:</span>
              <span className="spec-val">1024 output dimensions</span>
            </div>
            <div className="arch-spec-item">
              <span className="spec-lbl">Classifier Layer:</span>
              <span className="spec-val"><code>nn.Linear(1024, 250)</code></span>
            </div>
            <div className="arch-spec-item">
              <span className="spec-lbl">Fine-Tuning Strategy:</span>
              <span className="spec-val">Unfrozen denseblock2, transition2, denseblock3, transition3, denseblock4, norm5</span>
            </div>
            <div className="arch-spec-item">
              <span className="spec-lbl">Weight File Size:</span>
              <span className="spec-val">29.5 MB (8.0M parameters)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Hardware & SQLite Integration */}
      <div className="pipeline-section">
        <h3 className="section-heading">SQLite Database Schema & Hardware Runtime</h3>
        
        <div className="pipeline-grid">
          {/* SQLite Card */}
          <div className="pipeline-box">
            <div className="box-icon"><Database size={22} /></div>
            <h4 className="box-title">SQLite (doodlemind.db)</h4>
            <p className="box-desc">
              All 20,000 TU-Berlin sketch files are indexed into the <code>sample_sketches</code> table with absolute paths, class names, and creation metadata.
              User drawings saved from the canvas are persisted in the <code>user_drawings</code> table with confidence scores, model identifiers, and disk paths.
            </p>
            {dbStats && (
              <div className="db-quick-metrics">
                <div><strong>{dbStats.total_sample_sketches || '20,000'}</strong> Sample Sketches</div>
                <div><strong>{dbStats.total_categories || '250'}</strong> Categories</div>
                <div><strong>{dbStats.total_user_drawings || '0'}</strong> User Saved Drawings</div>
              </div>
            )}
          </div>

          {/* 224x224 Preprocessing Pipeline */}
          <div className="pipeline-box">
            <div className="box-icon"><Box size={22} /></div>
            <h4 className="box-title">224 × 224 Sketch Preprocessing</h4>
            <p className="box-desc">
              Incoming base64 strokes are alpha-blended onto a white background, analyzed for ink bounding boxes, and padded proportionally (+24px).
              The sketch is centered onto a 224 × 224 square tensor and normalized with ImageNet parameters (mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]).
            </p>
            <div className="tech-badge-list">
              <span className="tech-tag">BBox Auto-Crop</span>
              <span className="tech-tag">Aspect Padding</span>
              <span className="tech-tag">ImageNet Normalization</span>
            </div>
          </div>
        </div>
      </div>

      {/* Hardware Specifications Table */}
      <div className="tech-section">
        <h3 className="section-heading">Compute & Runtime Environment</h3>
        <div className="specs-table">
          <div className="spec-row">
            <span className="spec-name">Training GPU:</span>
            <span className="spec-value highlight">NVIDIA GeForce RTX 3060 Laptop GPU (6 GB VRAM)</span>
          </div>
          <div className="spec-row">
            <span className="spec-name">Inference Device:</span>
            <span className="spec-value green">{dbStats?.device ? dbStats.device.toUpperCase() : 'CUDA (NVIDIA RTX)'}</span>
          </div>
          <div className="spec-row">
            <span className="spec-name">Host Backend:</span>
            <span className="spec-value">FastAPI + Uvicorn (Python 3.13, PyTorch 2.13.0)</span>
          </div>
          <div className="spec-row">
            <span className="spec-name">Frontend Architecture:</span>
            <span className="spec-value">React 18 + Vite (Dockerized on Node 20 Alpine)</span>
          </div>
          <div className="spec-row">
            <span className="spec-name">Database Engine:</span>
            <span className="spec-value">SQLite 3 (Local Serverless Embedded Database)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
