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

function fmt(n) { return Math.round(Number(n)).toLocaleString('he-IL'); }
function fmtDec(n, d = 2) { return Number(n).toLocaleString('he-IL', { minimumFractionDigits: d, maximumFractionDigits: d }); }

function calcInvCurrentValue(inv) {
  if (inv.entryType === 'provident') return Number(inv.currentValue) || 0;
  const units = Number(inv.unitCount) || 0;
  const agorot = Number(inv.unitPriceAgorot) || 0;
  if (!units || !agorot) return 0;
  return (units * agorot) / 100;
}

const EXPENSE_COLORS = ['#e94560', '#f7932a', '#f7ae3a', '#4361ee', '#a259ff', '#b5b5b5', '#06d6a0', '#8ecae6', '#4895ef'];
const INCOME_COLORS  = ['#1a7a4a', '#3ecf8e', '#06d6a0', '#2ecc71', '#27ae60', '#52b788', '#74c69d', '#b7e4c7', '#40916c'];

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
  const { state } = useApp();

  const totalExpenses = state.expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const totalIncomes = (state.incomes || []).reduce((s, i) => s + (Number(i.amount) || 0), 0);
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

  // Savings pie sorted
  const savingsPieData = Array.from(new Set(state.savings.map(s => s.type).filter(Boolean)))
    .map(t => ({
      name: t,
      value: state.savings.filter(s => s.type === t).reduce((sum, s) => sum + (Number(s.currentAmount) || 0), 0),
      color: getColor(t),
    }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value);

  // Investments pie by type, sorted, with profit per type
  const invTypes = Array.from(new Set(state.investments.map(inv => inv.type).filter(Boolean)));
  const invPieData = invTypes.map(t => {
    const group = state.investments.filter(inv => inv.type === t);
    const val = group.reduce((s, inv) => s + calcInvCurrentValue(inv), 0);
    const dep = group.reduce((s, inv) => s + (Number(inv.totalDeposits) || 0), 0);
    return { name: t, value: val, deposits: dep, profit: val - dep, color: getColor(t) };
  }).filter(d => d.value > 0).sort((a, b) => b.value - a.value);

  const invProfitMap = Object.fromEntries(invPieData.map(d => [d.name, d.profit]));

  // Expenses pie sorted
  const expensesByDomain = state.expenses.reduce((acc, e) => {
    acc[e.domain] = (acc[e.domain] || 0) + (Number(e.amount) || 0);
    return acc;
  }, {});
  const expensePieData = Object.entries(expensesByDomain)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Incomes pie sorted
  const incomesByDomain = (state.incomes || []).reduce((acc, i) => {
    acc[i.domain] = (acc[i.domain] || 0) + (Number(i.amount) || 0);
    return acc;
  }, {});
  const incomePieData = Object.entries(incomesByDomain)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">דשבורד</h1>
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
        <div className="kpi-card kpi-balance">
          <div className="kpi-label">מאזן חודשי</div>
          <div className={`kpi-value ${balance >= 0 ? 'profit' : 'loss'}`}>
            {balance >= 0 ? '+' : ''}₪{fmt(balance)}
          </div>
          <div className="kpi-sub">הכנסות פחות הוצאות</div>
        </div>
      </div>

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

      {/* Investments + Savings row */}
      <div className="dash-two-col">
        {invPieData.length > 0 && (
          <div className="card dash-section">
            <SectionTitle>תיק השקעות לפי אפיק</SectionTitle>
            <div className="dash-chart-layout-sm">
              <ResponsiveContainer width={200} height={200}>
                <PieChart>
                  <Pie data={invPieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    innerRadius={45} outerRadius={85}>
                    {invPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={v => `₪${fmt(v)}`} />
                </PieChart>
              </ResponsiveContainer>
              <PieLegend data={invPieData} total={totalInvCurrentValue} showProfitCol profitMap={invProfitMap} />
            </div>
            <div className="section-footer">
              <span>סה"כ הפקדות: ₪{fmt(totalInvDeposits)}</span>
              <span className={totalInvProfit >= 0 ? 'positive' : 'negative'}>
                רווח: {totalInvProfit >= 0 ? '+' : ''}₪{fmt(totalInvProfit)} ({totalInvReturn >= 0 ? '+' : ''}{fmtDec(totalInvReturn)}%)
              </span>
            </div>
          </div>
        )}

        {savingsPieData.length > 0 && (
          <div className="card dash-section">
            <SectionTitle>חסכונות לפי מסלול</SectionTitle>
            <div className="dash-chart-layout-sm">
              <ResponsiveContainer width={200} height={200}>
                <PieChart>
                  <Pie data={savingsPieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    innerRadius={45} outerRadius={85}>
                    {savingsPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={v => `₪${fmt(v)}`} />
                </PieChart>
              </ResponsiveContainer>
              <PieLegend data={savingsPieData} total={totalSavings} />
            </div>
          </div>
        )}
      </div>

      {/* Income + Expenses row */}
      {(incomePieData.length > 0 || expensePieData.length > 0) && (
        <div className="dash-two-col">
          {incomePieData.length > 0 && (
            <div className="card dash-section">
              <SectionTitle>הכנסות חודשיות לפי תחום</SectionTitle>
              <div className="dash-chart-layout-sm">
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie data={incomePieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                      innerRadius={45} outerRadius={85}>
                      {incomePieData.map((_, i) => <Cell key={i} fill={INCOME_COLORS[i % INCOME_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={v => `₪${fmt(v)}`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="dash-legend">
                  {incomePieData.map((entry, i) => (
                    <div key={i} className="legend-row">
                      <span className="legend-dot" style={{ background: INCOME_COLORS[i % INCOME_COLORS.length] }} />
                      <span className="legend-name">{entry.name}</span>
                      <span className="legend-pct">{totalIncomes > 0 ? ((entry.value / totalIncomes) * 100).toFixed(1) : 0}%</span>
                      <span className="legend-amount">₪{fmt(entry.value)}</span>
                    </div>
                  ))}
                  <div className="legend-total"><span>סה"כ חודשי</span><span>₪{fmt(totalIncomes)}</span></div>
                </div>
              </div>
            </div>
          )}

          {expensePieData.length > 0 && (
            <div className="card dash-section">
              <SectionTitle>הוצאות חודשיות לפי תחום</SectionTitle>
              <div className="dash-chart-layout-sm">
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie data={expensePieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                      innerRadius={45} outerRadius={85}>
                      {expensePieData.map((_, i) => <Cell key={i} fill={EXPENSE_COLORS[i % EXPENSE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={v => `₪${fmt(v)}`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="dash-legend">
                  {expensePieData.map((entry, i) => (
                    <div key={i} className="legend-row">
                      <span className="legend-dot" style={{ background: EXPENSE_COLORS[i % EXPENSE_COLORS.length] }} />
                      <span className="legend-name">{entry.name}</span>
                      <span className="legend-pct">{totalExpenses > 0 ? ((entry.value / totalExpenses) * 100).toFixed(1) : 0}%</span>
                      <span className="legend-amount">₪{fmt(entry.value)}</span>
                    </div>
                  ))}
                  <div className="legend-total"><span>סה"כ חודשי</span><span>₪{fmt(totalExpenses)}</span></div>
                </div>
              </div>
            </div>
          )}
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
