import React, { useState } from 'react';
import './InsightsCard.css';

const LEVEL_CONFIG = {
  good:    { icon: '✅', label: 'טוב' },
  info:    { icon: '💡', label: 'מידע' },
  warning: { icon: '⚠️', label: 'שים לב' },
  danger:  { icon: '🔴', label: 'בעיה' },
};

export default function InsightsCard({ insights }) {
  const [open, setOpen] = useState(true);
  if (!insights || insights.length === 0) return null;

  return (
    <div className="insights-card">
      <div className="insights-header" onClick={() => setOpen(o => !o)}>
        <span className="insights-title">💬 תובנות והמלצות</span>
        <span className="insights-toggle">{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <ul className="insights-list">
          {insights.map((item, i) => {
            const cfg = LEVEL_CONFIG[item.level] || LEVEL_CONFIG.info;
            return (
              <li key={i} className={`insight-item insight-${item.level}`}>
                <span className="insight-icon">{cfg.icon}</span>
                <span className="insight-text">{item.text}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
