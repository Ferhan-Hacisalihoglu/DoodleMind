import React, { useState, useEffect } from 'react';
import { ArrowLeft, Trash2, Edit3, Calendar, Cpu, Sparkles, FolderHeart } from 'lucide-react';
import { fetchUserDrawings, deleteUserDrawing, getUserDrawingImageUrl } from '../utils/api';

export default function MyGalleryPage({ onBackToCanvas, onLoadDrawingToCanvas }) {
  const [drawings, setDrawings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const loadDrawings = async () => {
    setLoading(true);
    try {
      const data = await fetchUserDrawings();
      if (data && data.drawings) {
        setDrawings(data.drawings);
      }
    } catch (err) {
      console.error('Failed to load gallery drawings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDrawings();
  }, []);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this drawing from your gallery?')) return;
    setDeletingId(id);
    try {
      await deleteUserDrawing(id);
      setDrawings(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Failed to delete drawing.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="full-page-view">
      <div className="page-top-bar">
        <button className="back-btn" onClick={onBackToCanvas}>
          <ArrowLeft size={16} />
          <span>Back to Drawing Board</span>
        </button>
      </div>

      <div className="page-header">
        <div className="header-title-row">
          <div>
            <h1 className="page-title">My Sketch Gallery</h1>
            <p className="page-subtitle">
              Drawings you manually saved, along with their neural network predictions and timestamps stored in SQLite.
            </p>
          </div>
          <div className="gallery-count-badge">
            <FolderHeart size={18} />
            <span>{drawings.length} Saved Sketches</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="gallery-loading-state">
          <div className="spinner" />
          <span>Loading saved sketches from database...</span>
        </div>
      ) : drawings.length === 0 ? (
        <div className="gallery-empty-card">
          <div className="empty-icon-wrap">
            <Sparkles size={36} />
          </div>
          <h3>No drawings saved yet</h3>
          <p>
            When you sketch on the canvas, click the <strong>"Save to Gallery"</strong> button to keep your favorite drawings and predictions saved here.
          </p>
          <button className="primary-action-btn" onClick={onBackToCanvas}>
            <Edit3 size={16} />
            <span>Start Drawing</span>
          </button>
        </div>
      ) : (
        <div className="gallery-grid">
          {drawings.map((item) => (
            <div key={item.id} className="gallery-card">
              <div className="gallery-thumb-wrap">
                <img
                  src={getUserDrawingImageUrl(item.id)}
                  alt={item.predicted_class_tr || item.predicted_class}
                  className="gallery-thumb-img"
                  loading="lazy"
                />
              </div>

              <div className="gallery-info">
                <div className="gallery-title-row">
                  <h3 className="gallery-item-title">
                    {item.predicted_class_tr || item.predicted_class}
                  </h3>
                  <span className="gallery-pct">
                    {item.confidence ? `${(item.confidence * 100).toFixed(1)}%` : ''}
                  </span>
                </div>

                <div className="gallery-meta-tags">
                  <span className="meta-tag">
                    <Cpu size={12} />
                    {item.model_name === 'densenet121' ? 'DenseNet121' : 'MobileNetV2'}
                  </span>
                  <span className="meta-tag">
                    <Calendar size={12} />
                    {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Saved'}
                  </span>
                </div>

                <div className="gallery-card-actions">
                  <button
                    className="gallery-action-btn load"
                    onClick={() => onLoadDrawingToCanvas(getUserDrawingImageUrl(item.id))}
                    title="Load this sketch back onto the canvas"
                  >
                    <Edit3 size={14} />
                    <span>Open in Canvas</span>
                  </button>
                  <button
                    className="gallery-action-btn delete"
                    onClick={(e) => handleDelete(item.id, e)}
                    disabled={deletingId === item.id}
                    title="Delete sketch"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
