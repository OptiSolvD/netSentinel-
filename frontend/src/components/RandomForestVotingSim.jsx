import React, { useState, useEffect, useRef } from 'react';

export default function RandomForestVotingSim({ explanation }) {
  const [isSimulating, setIsSimulating] = useState(false);
  const [revealedCount, setRevealedCount] = useState(100); // default to all revealed
  const animationRef = useRef(null);

  if (!explanation || !explanation.random_forest_votes) return null;

  const votes = explanation.random_forest_votes;
  const treeVoteList = explanation.random_forest_tree_votes || [];
  const totalTrees = votes.total_trees || 100;
  const predictedClass = explanation.predicted_class || 'Exploits';

  const classColors = {
    Normal: '#10b981',
    Exploits: '#ef4444',
    Fuzzers: '#f97316',
    DoS: '#eab308',
    Analysis: '#8b5cf6',
    Backdoor: '#ec4899',
  };

  const startSimulation = () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setRevealedCount(0);

    let count = 0;
    const interval = setInterval(() => {
      count += 2;
      if (count >= totalTrees) {
        setRevealedCount(totalTrees);
        setIsSimulating(false);
        clearInterval(interval);
      } else {
        setRevealedCount(count);
      }
    }, 25);
    animationRef.current = interval;
  };

  useEffect(() => {
    return () => {
      if (animationRef.current) clearInterval(animationRef.current);
    };
  }, []);

  const activeTrees = treeVoteList.slice(0, revealedCount);
  const activeTallies = {};
  activeTrees.forEach((cls) => {
    activeTallies[cls] = (activeTallies[cls] || 0) + 1;
  });

  const winningCount = activeTallies[predictedClass] || votes[predictedClass] || 0;
  const winnerPct = ((winningCount / totalTrees) * 100).toFixed(0);

  return (
    <div style={{ background: '#090d16', borderRadius: 8, padding: 20, border: '1px solid #1e293b', margin: '16px 0' }}>
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '1rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
            <span>🌲🌲</span> Random Forest — 100-Tree Voting Simulation
          </h4>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Obtained per-tree predictions from fitted <code>RandomForestClassifier.estimators_</code> (100 independent trees)
          </span>
        </div>

        <button
          onClick={startSimulation}
          disabled={isSimulating}
          style={{
            background: isSimulating ? '#334155' : '#f59e0b',
            color: '#0f172a',
            border: 'none',
            padding: '8px 16px',
            borderRadius: 6,
            fontWeight: 800,
            fontSize: '0.8rem',
            cursor: isSimulating ? 'not-allowed' : 'pointer',
            boxShadow: isSimulating ? 'none' : '0 0 12px #f59e0b44',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {isSimulating ? `⚡ Tallying Votes (${revealedCount}/100)...` : '▶ Run Voting Simulation'}
        </button>
      </div>

      {/* Architecture Concept Diagram Banner */}
      <div
        style={{
          background: '#0f172a',
          padding: 14,
          borderRadius: 6,
          border: '1px solid #1e293b',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.2rem' }}>📦</span>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f8fafc' }}>
              Ensemble Bagging Architecture
            </div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
              Each tree evaluates a randomized bootstrap sample and feature subset to de-correlate individual errors.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem' }}>
          <span style={{ color: '#cbd5e1' }}>Consensus Plurality:</span>
          <strong style={{ color: classColors[predictedClass] || '#f59e0b' }}>
            {winningCount} / {totalTrees} {predictedClass} ({winnerPct}%)
          </strong>
        </div>
      </div>

      {/* 100 Tree Grid */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: '0.75rem', color: '#cbd5e1', fontWeight: 600 }}>
            Individual Estimator Votes ({revealedCount} / {totalTrees} Tallied):
          </span>
          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
            Hover any tree to inspect individual estimator vote
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(20, 1fr)',
            gap: 4,
            background: '#050811',
            padding: 12,
            borderRadius: 6,
            border: '1px solid #1e293b',
          }}
        >
          {Array.from({ length: totalTrees }).map((_, i) => {
            const isRevealed = i < revealedCount;
            const treeClass = treeVoteList[i] || 'Normal';
            const color = classColors[treeClass] || '#38bdf8';

            return (
              <div
                key={i}
                title={`Estimator Tree #${i + 1}: ${isRevealed ? treeClass : 'Awaiting tally...'}`}
                style={{
                  height: 22,
                  borderRadius: 3,
                  background: isRevealed ? `${color}30` : '#1e293b',
                  border: `1px solid ${isRevealed ? color : '#334155'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  color: isRevealed ? color : '#475569',
                  transition: 'all 0.15s',
                  boxShadow: isRevealed ? `0 0 8px ${color}44` : 'none',
                  cursor: 'pointer',
                }}
              >
                {isRevealed ? '🌲' : '•'}
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Vote Breakdown Bars */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
        {Object.entries(votes)
          .filter(([k]) => k !== 'total_trees')
          .map(([cls, finalVote]) => {
            const currentTally = activeTallies[cls] || (revealedCount === totalTrees ? finalVote : 0);
            const pct = ((currentTally / totalTrees) * 100).toFixed(0);
            const color = classColors[cls] || '#38bdf8';
            const isWinner = cls === predictedClass;

            return (
              <div
                key={cls}
                style={{
                  background: '#0f172a',
                  border: `1px solid ${isWinner ? color : '#1e293b'}`,
                  borderRadius: 6,
                  padding: 10,
                  boxShadow: isWinner ? `0 0 10px ${color}25` : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f8fafc' }}>{cls}</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color }}>
                    {currentTally} / {totalTrees}
                  </span>
                </div>
                <div style={{ width: '100%', height: 6, background: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: color,
                      transition: 'width 0.15s ease-out',
                    }}
                  />
                </div>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                  <span>{pct}% of forest</span>
                  {isWinner && <span style={{ color, fontWeight: 700 }}>Majority</span>}
                </div>
              </div>
            );
          })}
      </div>

      {/* Final Decision Consensus Banner */}
      <div
        style={{
          padding: 12,
          background: '#050811',
          borderRadius: 6,
          border: `1px solid ${classColors[predictedClass] || '#38bdf8'}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.85rem',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <span style={{ color: '#94a3b8' }}>
          Ensemble Voting Output:
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 800, color: '#f8fafc' }}>
            Final Prediction: <span style={{ color: classColors[predictedClass] || '#38bdf8' }}>{predictedClass}</span>
          </span>
          <span style={{ fontSize: '0.75rem', color: '#10b981', background: '#10b98120', padding: '2px 8px', borderRadius: 4, border: '1px solid #10b98155' }}>
            ✓ {winnerPct}% Forest Majority
          </span>
        </div>
      </div>
    </div>
  );
}