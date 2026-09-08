import React, { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import Header from './components/Header';
import Canvas from './components/Canvas';
import PredictionCard from './components/PredictionCard';
import SamplesBar from './components/SamplesBar';
import MyGalleryPage from './components/MyGalleryPage';
import TrainingLogPage from './components/TrainingLogPage';
import ModelCardPage from './components/ModelCardPage';
import {
  checkHealth,
  fetchModels,
  fetchFeaturedSamples,
  fetchRandomSample,
  predictSketch,
  saveUserDrawing,
  fetchUserDrawings,
  fetchStats,
  getSampleImageUrl
} from './utils/api';
import './App.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('canvas'); // 'canvas' | 'gallery' | 'training' | 'modelcard'
  const [selectedModel, setSelectedModel] = useState('mobilenetv2'); // 'mobilenetv2' | 'densenet121'
  const [predictionResult, setPredictionResult] = useState(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastDrawnImage, setLastDrawnImage] = useState(null);
  const [externalImageToLoad, setExternalImageToLoad] = useState(null);
  const [samples, setSamples] = useState([]);
  const [galleryCount, setGalleryCount] = useState(0);
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking');
  const [availableModels, setAvailableModels] = useState([]);
  const [stats, setStats] = useState(null);

  // Initialize data on component mount
  useEffect(() => {
    async function init() {
      try {
        const health = await checkHealth();
        if (health && health.status === 'online') {
          setBackendStatus('online');
        } else {
          setBackendStatus('offline');
        }

        const modelsData = await fetchModels().catch(() => null);
        if (modelsData && modelsData.models) {
          setAvailableModels(modelsData.models);
        }

        const samplesData = await fetchFeaturedSamples().catch(() => null);
        if (samplesData && samplesData.samples) {
          setSamples(samplesData.samples);
        }

        const drawingsData = await fetchUserDrawings().catch(() => null);
        if (drawingsData && drawingsData.drawings) {
          setGalleryCount(drawingsData.drawings.length);
        }

        const statsData = await fetchStats().catch(() => null);
        if (statsData) {
          setStats(statsData);
        }
      } catch (err) {
        console.error('Initialization error:', err);
        setBackendStatus('offline');
      }
    }

    init();
  }, []);

  // Run prediction on canvas drawing (DO NOT save automatically!)
  const handleStrokeEnd = useCallback(async (imageData) => {
    if (!imageData) {
      setPredictionResult(null);
      setLastDrawnImage(null);
      return;
    }

    setLastDrawnImage(imageData);
    setIsPredicting(true);

    try {
      // saveDrawing=false so drawing is not saved to SQLite on simple strokes
      const res = await predictSketch(imageData, selectedModel, false);
      setPredictionResult(res);

      if (res?.top_prediction?.percentage >= 85) {
        confetti({
          particleCount: 25,
          spread: 50,
          origin: { y: 0.6 },
          colors: ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b']
        });
      }
    } catch (err) {
      console.error('Prediction failed:', err);
    } finally {
      setIsPredicting(false);
    }
  }, [selectedModel]);

  // Explicit user save action
  const handleSaveDrawing = async (imageData) => {
    if (!imageData || isSaving) return;
    setIsSaving(true);
    try {
      const res = await saveUserDrawing(imageData, selectedModel);
      if (res && res.success) {
        setGalleryCount(prev => prev + 1);
        confetti({
          particleCount: 35,
          spread: 60,
          origin: { y: 0.5 },
          colors: ['#7c3aed', '#6366f1', '#10b981']
        });
      }
    } catch (err) {
      console.error('Failed to save sketch to gallery:', err);
      alert('Could not save drawing to gallery.');
    } finally {
      setIsSaving(false);
    }
  };

  // When model is switched by user, re-predict with the new model immediately
  const handleModelChange = (newModel) => {
    setSelectedModel(newModel);
    if (lastDrawnImage) {
      setIsPredicting(true);
      predictSketch(lastDrawnImage, newModel, false)
        .then(res => setPredictionResult(res))
        .catch(err => console.error(err))
        .finally(() => setIsPredicting(false));
    }
  };

  // User clicked a sample card
  const handleSelectSample = (sample) => {
    if (!sample || !sample.id) return;
    const url = getSampleImageUrl(sample.id);
    setExternalImageToLoad(url);
  };

  // User clicked "Open random test sketch"
  const handleRandomSample = async () => {
    setIsLoadingSample(true);
    try {
      const sample = await fetchRandomSample();
      if (sample && sample.id) {
        const url = getSampleImageUrl(sample.id);
        setExternalImageToLoad(url);
      }
    } catch (err) {
      console.error('Failed to get random sample:', err);
    } finally {
      setIsLoadingSample(false);
    }
  };

  // Load a drawing from My Gallery onto the Canvas
  const handleLoadDrawingFromGallery = (imageUrl) => {
    setExternalImageToLoad(imageUrl);
    setActiveTab('canvas');
  };

  return (
    <div className="doodlemind-app">
      {/* Top Header with DoodleMind branding */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        backendStatus={backendStatus}
        deviceName={stats?.device}
        galleryCount={galleryCount}
      />

      {/* Main Content Area */}
      <main className="main-layout">
        {activeTab === 'canvas' && (
          <>
            {/* Hero Section */}
            <section className="hero-section">
              <div className="hero-content">
                <h1 className="hero-title">Start with a single line.</h1>
                <p className="hero-subtitle">
                  Doodle away. Let our neural model guess what you're drawing.
                </p>
              </div>
              <div className="hero-handwritten-note">
                <span className="handwritten-text">You don't need to draw well.</span>
                <span className="handwritten-arrow">⤴</span>
              </div>
            </section>

            {/* Two-Column Drawing and Prediction Grid */}
            <section className="workbench-grid">
              {/* Left: Canvas Area with Save Drawing button */}
              <div className="canvas-column">
                <Canvas
                  onStrokeEnd={handleStrokeEnd}
                  onSaveDrawing={handleSaveDrawing}
                  isSaving={isSaving}
                  externalImageToLoad={externalImageToLoad}
                  isPredicting={isPredicting}
                />
              </div>

              {/* Right: Prediction Card */}
              <div className="prediction-column">
                <PredictionCard
                  predictionResult={predictionResult}
                  selectedModel={selectedModel}
                  setSelectedModel={handleModelChange}
                  isPredicting={isPredicting}
                  availableModels={availableModels}
                />
              </div>
            </section>

            {/* Bottom: "Where to start?" Sample Sketches Gallery */}
            <section className="samples-bar-wrapper">
              <SamplesBar
                samples={samples}
                onSelectSample={handleSelectSample}
                onRandomSample={handleRandomSample}
                isLoadingSample={isLoadingSample}
              />
            </section>
          </>
        )}

        {/* Dedicated Full Page: My Gallery */}
        {activeTab === 'gallery' && (
          <MyGalleryPage
            onBackToCanvas={() => setActiveTab('canvas')}
            onLoadDrawingToCanvas={handleLoadDrawingFromGallery}
          />
        )}

        {/* Dedicated Full Page: Training Log */}
        {activeTab === 'training' && (
          <TrainingLogPage onBackToCanvas={() => setActiveTab('canvas')} />
        )}

        {/* Dedicated Full Page: Model Card */}
        {activeTab === 'modelcard' && (
          <ModelCardPage 
            onBackToCanvas={() => setActiveTab('canvas')} 
            dbStats={stats} 
          />
        )}
      </main>
    </div>
  );
}
