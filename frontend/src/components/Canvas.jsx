import React, { useRef, useState, useEffect, useCallback } from 'react';
import { RotateCcw, Trash2, Edit3, Eraser, Bookmark, Check } from 'lucide-react';

export default function Canvas({ onStrokeEnd, onSaveDrawing, isSaving, externalImageToLoad, isPredicting }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lineWidth, setLineWidth] = useState(6);
  const [tool, setTool] = useState('pen'); // 'pen' | 'eraser'
  const [history, setHistory] = useState([]);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Initialize canvas with clean white background and exact pixel alignment
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Save existing drawing if any
    let tempImgData = null;
    if (canvas.width > 0 && canvas.height > 0) {
      try {
        tempImgData = canvas.toDataURL();
      } catch (e) {
        tempImgData = null;
      }
    }

    // Set canvas internal dimensions to match container exactly
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Fill white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Restore drawing if existed
    if (tempImgData) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = tempImgData;
    }
  }, []);

  useEffect(() => {
    initCanvas();
    const handleResize = () => initCanvas();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [initCanvas]);

  // Save canvas state to undo stack
  const saveState = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory(prev => [...prev.slice(-25), imageData]);
  }, []);

  // Handle undo action
  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const newHistory = [...history];
    const previousState = newHistory.pop();
    setHistory(newHistory);
    
    if (previousState) {
      ctx.putImageData(previousState, 0, 0);
      if (newHistory.length === 0) {
        setHasDrawn(false);
      }
      onStrokeEnd(canvas.toDataURL('image/png'));
    }
  }, [history, onStrokeEnd]);

  // Global Ctrl+Z / Cmd+Z handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo]);

  // Clear canvas
  const handleClear = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    const rect = container.getBoundingClientRect();
    
    saveState();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);
    setHasDrawn(false);
    onStrokeEnd(null);
  };

  // Trigger Save Drawing to Gallery
  const triggerSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn || isSaving) return;
    const imgData = canvas.toDataURL('image/png');
    if (onSaveDrawing) {
      await onSaveDrawing(imgData);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    }
  };

  // Load external sample sketch onto canvas
  useEffect(() => {
    if (!externalImageToLoad) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    const rect = container.getBoundingClientRect();

    saveState();
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, rect.width, rect.height);

      const padding = 40;
      const scale = Math.min((rect.width - padding) / img.width, (rect.height - padding) / img.height);
      const x = (rect.width - img.width * scale) / 2;
      const y = (rect.height - img.height * scale) / 2;
      
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
      setHasDrawn(true);
      onStrokeEnd(canvas.toDataURL('image/png'));
    };
    img.src = externalImageToLoad;
  }, [externalImageToLoad]);

  // Pointer event coordinate calculator
  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      // fallback
    }

    saveState();
    const { x, y } = getCoordinates(e);
    const ctx = canvas.getContext('2d');

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : '#18181b';
    ctx.fillStyle = tool === 'eraser' ? '#ffffff' : '#18181b';
    ctx.arc(x, y, lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y);

    setIsDrawing(true);
    setHasDrawn(true);
  };

  const handlePointerMove = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : '#18181b';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handlePointerUp = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas && hasDrawn) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (err) {
        // fallback
      }
      onStrokeEnd(canvas.toDataURL('image/png'));
    }
  };

  return (
    <div className="canvas-card">
      {/* Canvas Top Bar */}
      <div className="canvas-header">
        <div className="canvas-title">
          <span className="dot-indicator" />
          <span>Drawing Canvas</span>
          {isPredicting && <span className="predicting-tag">Predicting...</span>}
        </div>

        <div className="canvas-toolbar">
          {/* Pen / Eraser toggle */}
          <div className="tool-selector">
            <button 
              className={`tool-btn ${tool === 'pen' ? 'active' : ''}`}
              onClick={() => setTool('pen')}
              title="Pen"
            >
              <Edit3 size={15} />
            </button>
            <button 
              className={`tool-btn ${tool === 'eraser' ? 'active' : ''}`}
              onClick={() => setTool('eraser')}
              title="Eraser"
            >
              <Eraser size={15} />
            </button>
          </div>

          {/* Stroke Width Picker */}
          <div className="stroke-selector">
            {[4, 7, 12].map(w => (
              <button 
                key={w}
                className={`stroke-btn ${lineWidth === w ? 'active' : ''}`}
                onClick={() => setLineWidth(w)}
                title={`${w}px width`}
              >
                <span className="stroke-circle" style={{ width: `${w + 2}px`, height: `${w + 2}px` }} />
              </button>
            ))}
          </div>

          <div className="divider-v" />

          {/* Save to Gallery Button */}
          <button
            className={`save-gallery-btn ${justSaved ? 'saved' : ''}`}
            onClick={triggerSave}
            disabled={!hasDrawn || isSaving}
            title="Save this drawing and its prediction to My Gallery"
          >
            {justSaved ? <Check size={14} /> : <Bookmark size={14} />}
            <span>{justSaved ? 'Saved!' : isSaving ? 'Saving...' : 'Save Drawing'}</span>
          </button>

          {/* Undo Button */}
          <button 
            className="action-btn"
            onClick={handleUndo} 
            disabled={history.length === 0}
            title="Undo (Ctrl+Z)"
          >
            <RotateCcw size={15} />
            <span>Undo</span>
          </button>

          {/* Clear Button */}
          <button 
            className="action-btn danger"
            onClick={handleClear} 
            disabled={!hasDrawn}
            title="Clear canvas"
          >
            <Trash2 size={15} />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Drawing Surface with fixed container and pointer events */}
      <div className="canvas-container" ref={containerRef}>
        <canvas
          ref={canvasRef}
          className={`drawing-canvas ${tool === 'eraser' ? 'eraser-mode' : 'pen-mode'}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>

      {/* Canvas Footer */}
      <div className="canvas-footer">
        <span className="footer-note">Your drawing. Never seen before.</span>
        <div className="shortcut-tag">
          <kbd>⌘</kbd> <kbd>Z</kbd> undo
        </div>
      </div>
    </div>
  );
}
