import React, { useState } from 'react';
import Modal from './Modal';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './HistoryChartModal.css';

function fmt(n) { return Math.round(Number(n)).toLocaleString('he-IL'); }
function fmtDec(n) { return Number(n).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export default function HistoryChartModal({ name, data, onClose }) {
  // data: [{ date, value, deposits }]
  const [mode, setMode] = useState('value');

  const chartData = data.map(d => ({
    date: d.date,
    value: d.value,
    pct: d.deposits > 0 ? ((d.value - d.deposits) / d.deposits * 100) : null,
  }));

  const hasReturn = chartData.some(d => d.pct !== null);

  if (data.length < 2) {
    return (
      <Modal title={`היסטוריה — ${name}`} onClose={onClose}>
        <p style={{ textAlign: 'center', color: '#999', padding: '48px 0', lineHeight: 1.8 }}>
          אין מספיק נתונים היסטוריים עדיין.<br />
          הנתונים יצטברו ב-1 ו-20 בכל חודש.
        </p>
      </Modal>
    );
  }

  return (
    <Modal title={`היסטוריה — ${name}`} onClose={onClose}>
      {hasReturn && (
        <div className="chart-toggle">
          <button className={`chart-toggle-btn${mode === 'value' ? ' active' : ''}`} onClick={() => setMode('value')}>ערך (₪)</button>
          <button className={`chart-toggle-btn${mode === 'pct' ? ' active' : ''}`} onClick={() => setMode('pct')}>תשואה (%)</button>
        </div>
      )}
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis
            tickFormatter={mode === 'value' ? v => `₪${fmt(v)}` : v => `${fmtDec(v)}%`}
            tick={{ fontSize: 11 }}
            width={88}
          />
          <Tooltip
            formatter={mode === 'value'
              ? v => [`₪${fmt(v)}`, 'ערך']
              : v => v !== null ? [`${fmtDec(v)}%`, 'תשואה'] : ['—', 'תשואה']
            }
          />
          {mode === 'value'
            ? <Line type="monotone" dataKey="value" name="ערך" stroke="#4361ee" strokeWidth={2.5} dot={{ r: 4 }} />
            : <Line type="monotone" dataKey="pct" name="תשואה" stroke="#3ecf8e" strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
          }
        </LineChart>
      </ResponsiveContainer>
    </Modal>
  );
}
