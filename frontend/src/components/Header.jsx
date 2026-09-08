import React from 'react';
import { Images } from 'lucide-react';

export default function Header({ activeTab, setActiveTab, backendStatus, deviceName, galleryCount }) {
  return (
    <header className="site-header">
      <div className="header-left">
        <div className="brand-logo" onClick={() => setActiveTab('canvas')}>
          <div className="logo-icon">DM</div>
          <span className="logo-text">DoodleMind<span className="logo-dot">.</span></span>
        </div>
      </div>

      <nav className="header-nav">
        <div className="nav-pill-container">
          <button 
            className={`nav-pill ${activeTab === 'canvas' ? 'active' : ''}`}
            onClick={() => setActiveTab('canvas')}
          >
            Drawing Board
          </button>
          <button 
            className={`nav-pill ${activeTab === 'gallery' ? 'active' : ''}`}
            onClick={() => setActiveTab('gallery')}
          >
            My Gallery {galleryCount > 0 && <span className="nav-counter">{galleryCount}</span>}
          </button>
          <button 
            className={`nav-pill ${activeTab === 'training' ? 'active' : ''}`}
            onClick={() => setActiveTab('training')}
          >
            Training Log
          </button>
          <button 
            className={`nav-pill ${activeTab === 'modelcard' ? 'active' : ''}`}
            onClick={() => setActiveTab('modelcard')}
          >
            Model Card
          </button>
        </div>
      </nav>

      <div className="header-right">
        <div className="status-badge" title="Trained on NVIDIA GeForce RTX 3060 Laptop GPU (6 GB VRAM)">
          <span className={`pulse-dot ${backendStatus === 'online' ? 'online' : 'offline'}`} />
          <span className="status-text">
            {backendStatus === 'online' ? 'RTX 3060 GPU • Local' : 'Connecting to API...'}
          </span>
        </div>
      </div>
    </header>
  );
}
