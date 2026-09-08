import React from 'react';
import { Dices } from 'lucide-react';
import { getSampleImageUrl } from '../utils/api';

export default function SamplesBar({ samples, onSelectSample, onRandomSample, isLoadingSample }) {
  return (
    <div className="samples-section">
      <div className="samples-header">
        <div className="header-text-group">
          <span className="samples-title">Where to start?</span>
          <span className="samples-subtitle">
            Draw one of these or load a real test sketch.
          </span>
        </div>

        <div className="samples-actions">
          <button 
            className="random-btn" 
            onClick={onRandomSample} 
            disabled={isLoadingSample}
            title="Load a random sketch from the 20,000 test dataset"
          >
            <Dices size={16} />
            <span>Open random test sketch</span>
          </button>
          <span className="unseen-note">Model was not trained on these test examples.</span>
        </div>
      </div>

      <div className="samples-grid">
        {samples && samples.length > 0 ? (
          samples.map((s) => (
            <button
              key={s.id || s.category}
              className="sample-card"
              onClick={() => onSelectSample(s)}
              title={`Load real test sketch: ${s.category_name || s.category_tr}`}
            >
              <div className="sample-icon-wrap">
                {s.id ? (
                  <img
                    src={getSampleImageUrl(s.id)}
                    alt={s.category_name || s.category_tr}
                    className="sample-sketch-thumb"
                    loading="lazy"
                  />
                ) : (
                  <span className="sample-placeholder-box">✏️</span>
                )}
              </div>
              <span className="sample-label">{s.category_name || s.category_tr}</span>
            </button>
          ))
        ) : (
          <div className="samples-loading">Loading samples from database...</div>
        )}
      </div>
    </div>
  );
}
