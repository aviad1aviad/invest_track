import React from 'react';
import { useApp } from '../context/AppContext';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import InsightsCard from '../components/common/InsightsCard';
import { getDashboardInsights } from '../utils/insights';
import './Page.css';
import './Dashboard.css';

const PALETTE = ['#4361ee', '#f7932a', '#3ecf8e', '#f7ae3a', '#e94560', '#a259ff', '#b5b5b5', '#06d6a0', '#8ecae6', '#4895ef'];
const colorCache = {};
let colorIdx = 0;
function getColor(name) {
  if (!colorCache[name]) colorCache[name] = PALETTE[colorIdx++ % PALETTE.length];
  return colorCache[name];
}

function fmt(n) { return Math.round(Number(n)).toLocaleString('he-IL'); }
function fmtDec(n, d = 2) { return Number(n).toLocaleString('he-IL', { minimumFractionDigits: d, maximumFractionDigits: d }); }

function calcInvCurrentValue(inv) {
  if (inv.currency === 'USD') {
    const usd = Number(inv.currentValueUSD) || 0;
    const rate = Number(inv.currentExchangeRate) || 0;
    return usd && rate ? usd * rate : 0;
  }
  if (inv.entryType === 'provident') return Number(inv.currentValue) || 0;
  const units = Number(inv.unitCount) || 0;
  const agorot = Number(inv.unitPriceAgorot) || 0;
  if (!units || !agorot) return 0;
  return (units * agorot) / 100;
}

function SectionTitle({ children }) {
  return <h2 className="dash-section-title">{children}</h2>;
}

function PieLegend({ data, total, showProfitCol = false, profitMap = {} }) {
  return (
    <div className="dash-legend">
      {data.map((entry, i) => (
        <div key={i} className="legend-row">
          <span className="legend-dot" style={{ background: entry.color }} />
          <span className="legend-name">{entry.name}</span>
          <span className="legend-pct">{total > 0 ? ((entry.value / total) * 100).toFixed(1) : 0}%</span>
          <span className="legend-amount">₪{fmt(entry.value)}</span>
          {showProfitCol && profitMap[entry.name] !== undefined && (
            <span className={profitMap[entry.name] >= 0 ? 'legend-profit positive' : 'legend-profit negative'}>
              {profitMap[entry.name] >= 0 ? '+' : ''}₪{fmt(profitMap[entry.name])}
            </span>
          )}
        </div>
      ))}
      <div className="legend-total">
        <span>סה"כ</span>
        <span>₪{fmt(total)}</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { state, dispatch } = useApp();

  const totalExpenses = state.expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const totalIncomes = (state.incomes || []).reduce((s, i) => s + (Number(i.amount) || 0), 0);

  const avgCreditMonthly = (() => {
    const txns = state.creditTransactions || [];
    if (txns.length === 0) return 0;
    const months = new Set(txns.map(t => {
      const d = t.billingDate || t.date || '';
      return d.slice(0, 7);
    }).filter(Boolean));
    const total = txns.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    return months.size > 0 ? total / months.size : 0;
  })();
  const balance = totalIncomes - totalExpenses;
  const totalSavings = state.savings.reduce((s, sv) => s + (Number(sv.currentAmount) || 0), 0);
  const totalInvCurrentValue = state.investments.reduce((s, inv) => s + calcInvCurrentValue(inv), 0);
  const totalInvDeposits = state.investments.reduce((s, inv) => s + (Number(inv.totalDeposits) || 0), 0);
  const totalInvProfit = totalInvCurrentValue - totalInvDeposits;
  const totalInvReturn = totalInvDeposits > 0 ? (totalInvProfit / totalInvDeposits) * 100 : 0;
  const grandTotal = totalSavings + totalInvCurrentValue;

  // Global pie: savings + investments combined by type, sorted high→low
  const typeMap = {};
  state.savings.forEach(s => {
    if (s.type) typeMap[s.type] = (typeMap[s.type] || 0) + (Number(s.currentAmount) || 0);
  });
  state.investments.forEach(inv => {
    const val = calcInvCurrentValue(inv);
    if (val && inv.type) typeMap[inv.type] = (typeMap[inv.type] || 0) + val;
  });

  const globalPieData = Object.entries(typeMap)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value, color: getColor(name) }))
    .sort((a, b) => b.value - a.value);

  const creditCategoryPie = (() => {
    const txns = state.creditTransactions || [];
    if (txns.length === 0) return [];
    const months = new Set(txns.map(t => (t.billingDate || t.date || '').slice(0, 7)).filter(Boolean));
    const divisor = months.size || 1;
    const map = {};
    txns.forEach(t => {
      const cat = t.category || 'לא מסווג';
      map[cat] = (map[cat] || 0) + (Number(t.amount) || 0);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value: Math.round(value / divisor), color: getColor(name) }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  })();

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">דשבורד</h1>
        <button className="btn btn-secondary" onClick={() => dispatch({ type: 'TAKE_SNAPSHOT' })}>
          📸 צלם snapshot
        </button>
      </div>

      {/* KPI cards */}
      <div className="kpi-grid">
        <div className="kpi-card kpi-main">
          <div className="kpi-label">סה"כ נכסים</div>
          <div className="kpi-value main">₪{fmt(grandTotal)}</div>
          <div className="kpi-sub">חסכונות + השקעות</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">חסכונות</div>
          <div className="kpi-value">₪{fmt(totalSavings)}</div>
          <div className="kpi-sub">{state.savings.length} קרנות</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">תיק השקעות</div>
          <div className="kpi-value">₪{fmt(totalInvCurrentValue)}</div>
          <div className="kpi-sub">{state.investments.length} נכסים</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">רווח תיק</div>
          <div className={`kpi-value ${totalInvProfit >= 0 ? 'profit' : 'loss'}`}>
            {totalInvProfit >= 0 ? '+' : ''}₪{fmt(totalInvProfit)}
          </div>
          <div className={`kpi-sub ${totalInvReturn >= 0 ? 'profit' : 'loss'}`}>
            {totalInvReturn >= 0 ? '+' : ''}{fmtDec(totalInvReturn)}% תשואה
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">הכנסות חודשיות</div>
          <div className="kpi-value income">₪{fmt(totalIncomes)}</div>
          <div className="kpi-sub">{(state.incomes || []).length} הכנסות</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">הוצאות חודשיות</div>
          <div className="kpi-value expenses">₪{fmt(totalExpenses)}</div>
          <div className="kpi-sub">{state.expenses.length} הוצאות קבועות</div>
        </div>
        {avgCreditMonthly > 0 && (
          <div className="kpi-card">
            <div className="kpi-label">ממוצע כרטיסים</div>
            <div className="kpi-value expenses">₪{fmt(avgCreditMonthly)}</div>
            <div className="kpi-sub">ממוצע חודשי בפועל</div>
          </div>
        )}
        <div className="kpi-card kpi-balance">
          <div className="kpi-label">מאזן חודשי</div>
          <div className={`kpi-value ${balance >= 0 ? 'profit' : 'loss'}`}>
            {balance >= 0 ? '+' : ''}₪{fmt(balance)}
          </div>
          <div className="kpi-sub">הכנסות פחות הוצאות</div>
        </div>
      </div>

      <InsightsCard insights={getDashboardInsights(state)} />

      {/* Historical growth chart */}
      {(state.snapshots || []).length >= 2 && (
        <div className="card dash-section">
          <SectionTitle>צמיחת נכסים לאורך זמן</SectionTitle>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={state.snapshots} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `₪${fmt(v)}`} tick={{ fontSize: 11 }} width={80} />
              <Tooltip formatter={(v, name) => [`₪${fmt(v)}`, name]} />
              <Legend />
              <Line type="monotone" dataKey="grandTotal" name='סה"כ נכסים' stroke="#4361ee" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="totalSavings" name="חסכונות" stroke="#3ecf8e" strokeWidth={1.5} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="totalInvestments" name="השקעות" stroke="#f7932a" strokeWidth={1.5} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Global allocation */}
      {globalPieData.length > 0 && (
        <div className="card dash-section">
          <SectionTitle>פיזור כלל הנכסים לפי אפיק</SectionTitle>
          <div className="dash-chart-layout">
            <ResponsiveContainer width={260} height={260}>
              <PieChart>
                <Pie data={globalPieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                  innerRadius={55} outerRadius={110}>
                  {globalPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={v => `₪${fmt(v)}`} />
              </PieChart>
            </ResponsiveContainer>
            <PieLegend data={globalPieData} total={grandTotal} />
          </div>
        </div>
      )}

      {/* Credit expenses by category — average monthly */}
      {creditCategoryPie.length > 0 && (
        <div className="card dash-section">
          <SectionTitle>ממוצע הוצאות חודשיות לפי קטגוריה</SectionTitle>
          <div className="dash-chart-layout">
            <ResponsiveContainer width={260} height={260}>
              <PieChart>
                <Pie data={creditCategoryPie} dataKey="value" nameKey="name" cx="50%" cy="50%"
                  innerRadius={55} outerRadius={110}>
                  {creditCategoryPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={v => `₪${fmt(v)}`} />
              </PieChart>
            </ResponsiveContainer>
            <PieLegend data={creditCategoryPie} total={creditCategoryPie.reduce((s, d) => s + d.value, 0)} />
          </div>
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
