import React, { useEffect, useState } from 'react';
import Navbar from './components/Navbar';
import Overview from './pages/Overview';
import HowItWorks from './pages/HowItWorks';
import TestEvaluate from './pages/TestEvaluate';
import LiveTraffic from './pages/LiveTraffic';
import Reports from './pages/Reports';
import ModelEvolution from './pages/ModelEvolution';
import {
  fetchHealth,
  fetchModelEvaluation,
  fetchModelEvolution,
  fetchModelMetadata,
} from './services/api';
import './styles.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [health, setHealth] = useState(null);
  const [healthError, setHealthError] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [metadataError, setMetadataError] = useState(null);
  const [officialEvaluation, setOfficialEvaluation] = useState(null);
  const [evaluationError, setEvaluationError] = useState(null);
  const [modelEvolution, setModelEvolution] = useState(null);
  const [modelEvolutionError, setModelEvolutionError] = useState(null);
  const [lastAnalysis, setLastAnalysis] = useState(null);

  const refreshMetadata = () => {
    fetchModelMetadata()
      .then((data) => {
        setMetadata(data);
        setMetadataError(null);
      })
      .catch((error) => {
        setMetadata(null);
        setMetadataError(error.message);
      });
  };

  const refreshEvaluation = () => {
    fetchModelEvaluation()
      .then((data) => {
        setOfficialEvaluation(data);
        setEvaluationError(null);
      })
      .catch((error) => {
        setOfficialEvaluation(null);
        setEvaluationError(error.message);
      });
  };

  const refreshModelEvolution = () => {
    fetchModelEvolution()
      .then((data) => {
        setModelEvolution(data);
        setModelEvolutionError(null);
      })
      .catch((error) => {
        setModelEvolution(null);
        setModelEvolutionError(error.message);
      });
  };

  const navigateTo = (tab) => {
    setActiveTab(tab);
    if (tab === 'reports') refreshEvaluation();
    if (tab === 'overview' || tab === 'how') refreshMetadata();
    if (tab === 'evolution') refreshModelEvolution();
  };

  useEffect(() => {
    let active = true;

    fetchHealth()
      .then((data) => active && setHealth(data))
      .catch((error) => active && setHealthError(error.message));
    refreshMetadata();
    refreshEvaluation();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="app-shell">
      <Navbar
        activeTab={activeTab}
        setActiveTab={navigateTo}
        health={health}
        healthError={healthError}
      />
      <main className="main-content">
        {activeTab === 'overview' && (
          <Overview
            metadata={metadata}
            metadataError={metadataError}
            health={health}
            healthError={healthError}
            lastAnalysis={lastAnalysis}
            onNavigate={navigateTo}
          />
        )}
        {activeTab === 'how' && (
          <HowItWorks
            lastAnalysis={lastAnalysis}
            metadata={metadata}
            metadataError={metadataError}
          />
        )}
        {activeTab === 'evaluate' && (
          <TestEvaluate onAnalysis={setLastAnalysis} />
        )}
        {activeTab === 'live' && <LiveTraffic />}
        {activeTab === 'reports' && (
          <Reports
            metadata={metadata}
            metadataError={metadataError}
            evaluation={officialEvaluation}
            evaluationError={evaluationError}
          />
        )}
        {activeTab === 'evolution' && (
          <ModelEvolution data={modelEvolution} error={modelEvolutionError} />
        )}
      </main>
    </div>
  );
}
