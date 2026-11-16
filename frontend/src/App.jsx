import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import ModelPerformance from './pages/ModelPerformance';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div style={{ minHeight: '100vh', background: '#090d16', color: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} modelVersion="v2.0-clean" />
      <main>
        {activeTab === 'dashboard' ? <Dashboard /> : <ModelPerformance />}
      </main>
    </div>
  );
}
