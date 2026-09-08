import React from 'react';
import { Sparkles } from 'lucide-react';

export default function PredictionCard({
  predictionResult,
  selectedModel,
  setSelectedModel,
  isPredicting,
  availableModels
}) {
  const data = predictionResult;
  const topPrediction = data?.top_prediction;
  const comment = data?.comment;
  const previewImg = data?.preview_image;

  return (
    <div className="prediction-card">
      {/* Prediction Card Header */}
      <div className="prediction-header">
        <span className="card-title">Model Prediction</span>
        <div className="status-indicator">
          <span className={`status-dot ${isPredicting ? 'busy' : 'ready'}`} />
          <span className="status-label">{isPredicting ? 'Computing...' : 'Ready'}</span>
        </div>
      </div>

      {/* Model Selector Tabs */}
      <div className="model-tabs-container two-cols">
        <button
          className={`model-tab ${selectedModel === 'mobilenetv2' ? 'active' : ''}`}
          onClick={() => setSelectedModel('mobilenetv2')}
        >
          <span className="tab-title">MobileNetV2</span>
          <span className="tab-sub">Fast • 3.5M</span>
        </button>

        <button
          className={`model-tab ${selectedModel === 'densenet121' ? 'active' : ''}`}
          onClick={() => setSelectedModel('densenet121')}
        >
          <span className="tab-title">DenseNet121</span>
          <span className="tab-sub">High Accuracy • 8M</span>
        </button>
      </div>

      {/* Main Prediction Display Area */}
      {!topPrediction ? (
        <div className="empty-prediction">
          <div className="empty-icon-wrap">
            <Sparkles size={32} className="sparkle-icon" />
          </div>
          <h3 className="empty-title">You haven't drawn anything yet</h3>
          <p className="empty-desc">
            Doodle an object on the canvas to the left or click one of the test examples below.
          </p>
        </div>
      ) : (
        <div className="prediction-body">
          {/* Top Guess Hero (Clean English typography) */}
          <div className="top-guess-container clean">
            <div className="top-guess-info">
              <h2 className="top-guess-title">{topPrediction.class_name || topPrediction.class_tr}</h2>
              <p className="top-guess-comment">
                {comment || 'Model generated a prediction.'}
              </p>
            </div>
            <div className="top-guess-score-badge">
              <span className="score-val">{topPrediction.percentage_formatted}</span>
              <span className="score-lbl">CONFIDENCE</span>
            </div>
          </div>

          {/* Probability Bars */}
          {data?.predictions && (
            <div className="probability-list">
              {data.predictions.slice(0, 4).map((item, idx) => (
                <div key={item.class_en} className="prob-item">
                  <div className="prob-label-row">
                    <span className="prob-name">{item.class_name || item.class_tr}</span>
                    <span className="prob-percentage">{item.percentage_formatted}</span>
                  </div>
                  <div className="prob-bar-track">
                    <div
                      className={`prob-bar-fill rank-${idx + 1}`}
                      style={{ width: `${Math.max(item.percentage, 3)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 224x224 Model Input Preview */}
          {previewImg && (
            <div className="vision-preview-card">
              <div className="preview-thumb-box large-thumb">
                <img src={previewImg} alt="224x224 model tensor input" className="pixel-preview-224" />
              </div>
              <div className="preview-meta">
                <span className="meta-title">What I see</span>
                <span className="meta-desc">224 × 224 pixel input passed to the model</span>
                <span className="meta-speed">
                  {data?.inference_ms || 1.2} ms model inference
                </span>
              </div>
            </div>
          )}

          {/* Disclaimer text */}
          <div className="prediction-disclaimer">
            I only recognize the 250 sketch categories from the TU-Berlin dataset. Percentages represent normalized model probabilities.
          </div>
        </div>
      )}
    </div>
  );
}
