import React from 'react';

export default function MetricCard({ title, value, subtitle, color = '#38bdf8', icon }) {
  return (
    <div
      style={{
        background: '#1e293b',
        borderRadius: 8,
        padding: '16px 20px',
        border: '1px solid #334155',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {title}
        </span>
        {icon && <span style={{ fontSize: '1rem', color }}>{icon}</span>}
      </div>

      <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc', margin: '8px 0 4px' }}>
        {value}
      </div>

      {subtitle && (
        <span style={{ fontSize: '0.75rem', color: color }}>
          {subtitle}
        </span>
      )}
    </div>
  );
}
