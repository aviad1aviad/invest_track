import React from 'react';
import { useApp } from '../context/AppContext';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import './Page.css';
import './Dashboard.css';

const PALETTE = ['#4361ee', '#f7932a', '#3ecf8e', '#f7ae3a', '#e94560', '#a259ff', '#b5b5b5', '#06d6a0', '#8ecae6', '#4895ef'];
const colorCache = {};
let colorIdx = 0;
function getColor(name) {
  if (!colorCache[name]) colorCache[name] = PALETTE[colorIdx++ % PALETTE.length];
  return colorCache[name];
}

function fmt(n) { return Number(n).toLocaleString('he-IL'); }
function fmtDec(n, d = 2) { return Number(n).toLocaleString('he-IL', { minimumFractionDigits: d, maximumFractionDigits: d }); }

function calcInvCurrentValue(inv) {
  const units = Number(inv.unitCount) || 0;
  const price = Number(inv.unitPrice) || 0;
  return units && price ? units * price : 0;
}

export default function Dashboard() {
  const { state } = useApp();

  const totalExpenses = state.expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const totalSavings = state.savings.reduce((s, sv) => s + (Number(sv.currentAmount) || 0), 0);
  const totalInvCurrentValue = state.investments.reduce((s, inv) => s + calcInvCurrentValue(inv), 0);
  const totalInvDeposits = state.investments.reduce((s, inv) => s + (Number(inv.totalDeposits) || 0), 0);
  const totalInvProfit = totalInvCurrentValue - totalInvDeposits;
  const totalInvReturn = totalInvDeposits > 0 ? (totalInvProfit / totalInvDeposits) * 100 : 0;
  const grandTotal = totalSavings + totalInvCurrentValue;

  // Combine savings + investments by type for the global pie
  const typeMap = {};
  state.savings.forEach(s => {
    typeMap[s.type] = (typeMap[s.type] || 0) + (Number(s.currentAmount) || 0);
  });
  state.investments.forEach(inv => {
    const val = calcInvCurrentValue(inv);
    if (val) typeMap[inv.type] = (typeMap[inv.type] || 0) + val;
  });

  const globalPieData = Object.entries(typeMap)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value, color: getColor(name) }))
    .sort((a, b) => b.value - a.value);

  const savingsPieData = Array.from(new Set(state.savings.map(s => s.type).filter(Boolean)))
    .map(t => ({
      name: t,
      value: state.savings.filter(s => s.type === t).reduce((sum, s) => sum + (Number(s.currentAmount) || 0), 0),
      color: getColor(t),
    }))
    .filter(d => d.value > 0);

  const expensesByDomain = state.expenses.reduce((acc, e) => {
    acc[e.domain] = (acc[e.domain] || 0) + (Number(e.amount) || 0);
    return acc;
  }, {});

  const expensePieData = Object.entries(expensesByDomain)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const EXPENSE_COLORS = ['#4361ee', '#f7932a', '#3ecf8e', '#e94560', '#f7ae3a', '#a259ff', '#b5b5b5', '#06d6a0', '#8ecae6'];

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">דשבורד</h1>
      </div>

      {/* KPI cards */}
      <div className="kpi-grid">
        <div className="card kpi-card">
          <div className="kpi-label">סה"כ נכסים</div>
          <div className="kpi-value main">₪{fmt(grandTotal)}</div>
          <div className="kpi-sub">חסכונות + השקעות</div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-label">חסכונות</div>
          <div className="kpi-value">₪{fmt(totalSavings)}</div>
          <div className="kpi-sub">{state.savings.length} קרנות</div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-label">תיק השקעות</div>
          <div className="kpi-value">₪{fmt(totalInvCurrentValue)}</div>
          <div className="kpi-sub">{state.investments.length} נכסים</div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-label">רווח תיק השקעות</div>
          <div className={`kpi-value ${totalInvProfit >= 0 ? 'profit' : 'loss'}`}>
            {totalInvProfit >= 0 ? '+' : ''}₪{fmt(totalInvProfit)}
          </div>
          <div className={`kpi-sub ${totalInvReturn >= 0 ? 'profit' : 'loss'}`}>
            {totalInvReturn >= 0 ? '+' : ''}{fmtDec(totalInvReturn)}% תשואה
          </div>
        </div>
        <div className="card kpi-card expenses-card">
          <div className="kpi-label">הוצאות חודשיות</div>
          <div className="kpi-value expenses">₪{fmt(totalExpenses)}</div>
          <div className="kpi-sub">{state.expenses.length} הוצאות קבועות</div>
        </div>
      </div>

      {/* Global asset allocation */}
      {globalPieData.length > 0 && (
        <div className="card dash-section">
          <h2 className="dash-section-title">פיזור כלל הנכסים לפי אפיק</h2>
          <div className="dash-chart-layout">
            <ResponsiveContainer width={280} height={250}>
              <PieChart>
                <Pie data={globalPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}>
                  {globalPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={v => `₪${fmt(v)}`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="dash-legend">
              {globalPieData.map((entry, i) => (
                <div key={i} className="legend-row">
                  <span className="legend-dot" style={{ background: entry.color }} />
                  <span className="legend-name">{entry.name}</span>
                  <span className="legend-pct">{grandTotal > 0 ? ((entry.value / grandTotal) * 100).toFixed(1) : 0}%</span>
                  <span className="legend-amount">₪{fmt(entry.value)}</span>
                </div>
              ))}
              <div className="legend-total">
                <span>סה"כ</span>
                <span>₪{fmt(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="dash-two-col">
        {/* Savings breakdown */}
        {savingsPieData.length > 0 && (
          <div className="card dash-section">
            <h2 className="dash-section-title">חסכונות לפי מסלול</h2>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={savingsPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {savingsPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={v => `₪${fmt(v)}`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mini-total">סה"כ: ₪{fmt(totalSavings)}</div>
          </div>
        )}

        {/* Expenses breakdown */}
        {expensePieData.length > 0 && (
          <div className="card dash-section">
            <h2 className="dash-section-title">הוצאות לפי תחום</h2>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={expensePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {expensePieData.map((_, i) => <Cell key={i} fill={EXPENSE_COLORS[i % EXPENSE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => `₪${fmt(v)}`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mini-total">סה"כ חודשי: ₪{fmt(totalExpenses)}</div>
          </div>
        )}
      </div>

      {/* Investments table summary */}
      {state.investments.length > 0 && (
        <div className="card dash-section">
          <h2 className="dash-section-title">סיכום תיק השקעות לפי אפיק</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>אפיק</th>
                <th>שווי עדכני</th>
                <th>הפקדות</th>
                <th>רווח</th>
                <th>תשואה</th>
                <th>אחוז מהתיק</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(new Set(state.investments.map(inv => inv.type))).map(type => {
                const group = state.investments.filter(inv => inv.type === type);
                const val = group.reduce((s, inv) => s + calcInvCurrentValue(inv), 0);
                const dep = group.reduce((s, inv) => s + (Number(inv.totalDeposits) || 0), 0);
                const profit = val - dep;
                const ret = dep > 0 ? (profit / dep) * 100 : null;
                const portPct = totalInvCurrentValue > 0 ? ((val / totalInvCurrentValue) * 100).toFixed(1) : 0;
                return (
                  <tr key={type}>
                    <td><span className="badge inv-badge">{type}</span></td>
                    <td className="num">₪{fmt(val)}</td>
                    <td className="num">₪{fmt(dep)}</td>
                    <td className={profit >= 0 ? 'positive' : 'negative'}>
                      {profit >= 0 ? '+' : ''}₪{fmt(profit)}
                    </td>
                    <td className={ret >= 0 ? 'positive' : 'negative'}>
                      {ret !== null ? `${ret >= 0 ? '+' : ''}${fmtDec(ret)}%` : '—'}
                    </td>
                    <td className="num">{portPct}%</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="total-row">
                <td><strong>סה"כ</strong></td>
                <td className="num"><strong>₪{fmt(totalInvCurrentValue)}</strong></td>
                <td className="num"><strong>₪{fmt(totalInvDeposits)}</strong></td>
                <td className={totalInvProfit >= 0 ? 'positive' : 'negative'}>
                  <strong>{totalInvProfit >= 0 ? '+' : ''}₪{fmt(totalInvProfit)}</strong>
                </td>
                <td className={totalInvReturn >= 0 ? 'positive' : 'negative'}>
                  <strong>{totalInvReturn >= 0 ? '+' : ''}{fmtDec(totalInvReturn)}%</strong>
                </td>
                <td className="num"><strong>100%</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {grandTotal === 0 && totalExpenses === 0 && (
        <div className="empty-state">
          <p>הדשבורד ריק — הוסף הוצאות, חסכונות והשקעות כדי לראות סיכום כאן</p>
        </div>
      )}
    </div>
  );
}
