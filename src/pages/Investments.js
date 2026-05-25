import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import Modal from '../components/common/Modal';
import { FormField, Input, FormActions } from '../components/common/FormField';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import InsightsCard from '../components/common/InsightsCard';
import { getInvestmentInsights } from '../utils/insights';
import { getCurrentRate, getHistoricalRate } from '../utils/exchangeRate';
import './Page.css';
import './Investments.css';

const SUGGESTED_TYPES = ['מדד עולמי', 'מסלול מניות סחיר', 'ת"א 125', 'קרן גידור', 'ביטקוין', 'קרן כספית', 'מניות ארה"ב'];
const COLORS = ['#4361ee', '#f7932a', '#b5b5b5', '#3ecf8e', '#f7ae3a', '#e94560', '#a259ff'];

const EMPTY_FORM = {
  entryType: 'security',
  currency: 'ILS',
  name: '', type: '', securityNumber: '', investmentHouse: '',
  totalDeposits: '', accumulationFee: '',
  unitCount: '', unitPriceAgorot: '',
  currentValue: '',
  currentValueUSD: '', currentExchangeRate: '',
};

function fmt(n) { return Math.round(Number(n)).toLocaleString('he-IL'); }
function fmtDec(n, d = 2) { return Number(n).toLocaleString('he-IL', { minimumFractionDigits: d, maximumFractionDigits: d }); }
function pct(n) { return n !== '' && n !== undefined && n !== 0 ? `${Number(n).toFixed(3)}%` : '—'; }

function calcCurrentValue(inv) {
  if (inv.currency === 'USD') {
    const usd = Number(inv.currentValueUSD) || 0;
    const rate = Number(inv.currentExchangeRate) || 0;
    if (!usd || !rate) return null;
    return usd * rate;
  }
  if (inv.entryType === 'provident') {
    const val = Number(inv.currentValue) || 0;
    return val > 0 ? val : null;
  }
  const units = Number(inv.unitCount) || 0;
  const agorot = Number(inv.unitPriceAgorot) || 0;
  if (!units || !agorot) return null;
  return (units * agorot) / 100;
}

function getDeposits(inv) {
  if (inv.currency === 'USD' && inv.lots?.length > 0)
    return inv.lots.reduce((s, l) => s + (Number(l.amountILS) || 0), 0);
  return Number(inv.totalDeposits) || 0;
}

function calcProfit(inv) {
  const val = calcCurrentValue(inv);
  if (val === null) return null;
  return val - getDeposits(inv);
}

function calcReturn(inv) {
  const deposits = getDeposits(inv);
  const profit = calcProfit(inv);
  if (!deposits || profit === null) return null;
  return (profit / deposits) * 100;
}

// ── Lot row component ──────────────────────────────────────────────────────────
function LotRow({ lot, onDelete }) {
  return (
    <div className="lot-row">
      <span className="lot-date">{lot.date}</span>
      <span className="lot-usd">${Number(lot.amountUSD).toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
      <span className="lot-rate">×{Number(lot.exchangeRate).toFixed(3)}</span>
      <span className="lot-ils">₪{fmt(lot.amountILS)}</span>
      <button className="icon-btn lot-del" onClick={() => onDelete(lot.id)} title="מחק קנייה">🗑️</button>
    </div>
  );
}

// ── Add lot form ───────────────────────────────────────────────────────────────
function AddLotForm({ onAdd }) {
  const [date, setDate] = useState('');
  const [amountUSD, setAmountUSD] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = async () => {
    if (!date || !amountUSD) { setError('נא למלא תאריך וסכום'); return; }
    setLoading(true); setError('');
    try {
      const rate = await getHistoricalRate(date);
      const amountILS = Number(amountUSD) * rate;
      onAdd({ date, amountUSD: Number(amountUSD), exchangeRate: rate, amountILS });
      setDate(''); setAmountUSD('');
    } catch (e) {
      setError(e.message || 'שגיאה בשליפת שער');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-lot-form">
      <div className="add-lot-inputs">
        <input
          type="date" value={date} onChange={e => setDate(e.target.value)}
          className="lot-input" max={new Date().toISOString().slice(0, 10)}
        />
        <input
          type="number" value={amountUSD} onChange={e => setAmountUSD(e.target.value)}
          placeholder="סכום ($)" min="0" step="0.01" className="lot-input lot-amount"
        />
        <button type="button" className="btn btn-secondary lot-add-btn" onClick={handleAdd} disabled={loading}>
          {loading ? '...' : '+ הוסף'}
        </button>
      </div>
      {error && <div className="lot-error">{error}</div>}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Investments() {
  const { state, dispatch } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [pendingLots, setPendingLots] = useState([]);
  const [rateLoading, setRateLoading] = useState(false);
  const [rateError, setRateError] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterHouse, setFilterHouse] = useState('');

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setPendingLots([]);
    setRateError('');
    setShowModal(true);
  };

  const openEdit = inv => {
    setEditing(inv);
    setForm({ entryType: inv.entryType || 'security', currency: inv.currency || 'ILS', ...inv });
    setPendingLots(inv.lots || []);
    setRateError('');
    setShowModal(true);
  };

  const closeModal = () => setShowModal(false);
  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const fetchCurrentRate = async () => {
    setRateLoading(true); setRateError('');
    try {
      const rate = await getCurrentRate();
      setForm(f => ({ ...f, currentExchangeRate: rate }));
    } catch (e) {
      setRateError(e.message);
    } finally {
      setRateLoading(false);
    }
  };

  const handleAddLot = lot => {
    setPendingLots(prev => [...prev, { ...lot, id: Date.now() + Math.random() }]);
  };

  const handleDeleteLot = lotId => {
    setPendingLots(prev => prev.filter(l => l.id !== lotId));
  };

  const handleSubmit = e => {
    e.preventDefault();
    const isUSD = form.currency === 'USD';
    const payload = {
      ...form,
      lots: isUSD ? pendingLots : [],
      totalDeposits: isUSD
        ? pendingLots.reduce((s, l) => s + (Number(l.amountILS) || 0), 0)
        : Number(form.totalDeposits),
      accumulationFee: Number(form.accumulationFee),
      currentValueUSD: isUSD ? Number(form.currentValueUSD) : 0,
      currentExchangeRate: isUSD ? Number(form.currentExchangeRate) : 0,
      ...(form.currency === 'ILS' && form.entryType === 'security'
        ? { unitCount: Number(form.unitCount), unitPriceAgorot: Number(form.unitPriceAgorot), currentValue: 0 }
        : form.currency === 'ILS' && form.entryType === 'provident'
        ? { currentValue: Number(form.currentValue), unitCount: 0, unitPriceAgorot: 0 }
        : { unitCount: 0, unitPriceAgorot: 0, currentValue: 0 }
      ),
    };
    if (editing) {
      dispatch({ type: 'UPDATE_INVESTMENT', payload: { ...payload, id: editing.id } });
    } else {
      dispatch({ type: 'ADD_INVESTMENT', payload });
    }
    closeModal();
  };

  const handleDelete = id => {
    if (window.confirm('למחוק השקעה זו?')) dispatch({ type: 'DELETE_INVESTMENT', payload: id });
  };

  const totalCurrentValue = state.investments.reduce((s, inv) => s + (calcCurrentValue(inv) ?? 0), 0);
  const totalDepositsAll = state.investments.reduce((s, inv) => s + getDeposits(inv), 0);
  const valuedDeposits = state.investments
    .filter(inv => calcCurrentValue(inv) !== null)
    .reduce((s, inv) => s + getDeposits(inv), 0);
  const totalProfit = totalCurrentValue - valuedDeposits;
  const totalReturn = valuedDeposits > 0 ? (totalProfit / valuedDeposits) * 100 : null;

  const allTypes = [...new Set(state.investments.map(inv => inv.type).filter(Boolean))];
  const pieData = allTypes.map((t, i) => ({
    name: t,
    value: state.investments.filter(inv => inv.type === t).reduce((s, inv) => s + (calcCurrentValue(inv) ?? 0), 0),
    color: COLORS[i % COLORS.length],
  })).filter(d => d.value > 0).sort((a, b) => b.value - a.value);

  const sortedInvestments = [...state.investments].sort((a, b) => (calcCurrentValue(b) ?? 0) - (calcCurrentValue(a) ?? 0));

  const uniqueTypes = [...new Set(state.investments.map(inv => inv.type).filter(Boolean))].sort();
  const uniqueHouses = [...new Set(state.investments.map(inv => inv.investmentHouse).filter(Boolean))].sort();

  const filteredInvestments = sortedInvestments.filter(inv =>
    (!filterType || inv.type === filterType) &&
    (!filterHouse || inv.investmentHouse === filterHouse)
  );

  const filteredCurrentValue = filteredInvestments.reduce((s, inv) => s + (calcCurrentValue(inv) ?? 0), 0);
  const filteredDeposits = filteredInvestments.reduce((s, inv) => s + getDeposits(inv), 0);
  const filteredValuedDeposits = filteredInvestments.filter(inv => calcCurrentValue(inv) !== null).reduce((s, inv) => s + getDeposits(inv), 0);
  const filteredProfit = filteredCurrentValue - filteredValuedDeposits;
  const filteredReturn = filteredValuedDeposits > 0 ? (filteredProfit / filteredValuedDeposits) * 100 : null;

  const isSecurity = form.entryType === 'security';
  const isUSD = form.currency === 'USD';

  const lotsTotal = pendingLots.reduce((s, l) => s + (Number(l.amountILS) || 0), 0);
  const currentILS = isUSD && form.currentValueUSD && form.currentExchangeRate
    ? Number(form.currentValueUSD) * Number(form.currentExchangeRate)
    : null;

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">השקעות</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ השקעה חדשה</button>
      </div>

      <div className="inv-overview">
        <div className="card stat-card">
          <div className="summary-label">שווי עדכני</div>
          <div className="big-number">₪{fmt(totalCurrentValue)}</div>
        </div>
        <div className="card stat-card">
          <div className="summary-label">סה"כ הפקדות</div>
          <div className="big-number secondary">₪{fmt(totalDepositsAll)}</div>
        </div>
        <div className="card stat-card">
          <div className="summary-label">רווח כולל</div>
          <div className={`big-number ${totalProfit >= 0 ? 'profit' : 'loss'}`}>
            {valuedDeposits > 0 ? `${totalProfit >= 0 ? '+' : ''}₪${fmt(totalProfit)}` : '—'}
          </div>
        </div>
        <div className="card stat-card">
          <div className="summary-label">תשואה כוללת</div>
          <div className={`big-number ${totalReturn !== null && totalReturn >= 0 ? 'profit' : 'loss'}`}>
            {totalReturn !== null ? `${totalReturn >= 0 ? '+' : ''}${fmtDec(totalReturn)}%` : '—'}
          </div>
        </div>
      </div>

      {pieData.length > 0 && (
        <div className="card inv-chart-card">
          <h3 className="card-section-title">פיזור לפי סוג השקעה</h3>
          <div className="inv-chart-layout">
            <ResponsiveContainer width={260} height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={v => `₪${fmt(v)}`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pie-legend">
              {pieData.map((entry, i) => (
                <div key={i} className="type-row">
                  <span className="type-dot" style={{ background: entry.color }} />
                  <span className="type-name">{entry.name}</span>
                  <span className="type-pct">{totalCurrentValue > 0 ? ((entry.value / totalCurrentValue) * 100).toFixed(1) : 0}%</span>
                  <span className="type-amount">₪{fmt(entry.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {state.investments.length > 0 && (
        <InsightsCard insights={getInvestmentInsights(state.investments, calcCurrentValue)} />
      )}

      {(uniqueTypes.length > 1 || uniqueHouses.length > 1) && (
        <div className="filter-bar">
          {uniqueTypes.length > 1 && (
            <select className="filter-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="">כל המסלולים</option>
              {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          {uniqueHouses.length > 1 && (
            <select className="filter-select" value={filterHouse} onChange={e => setFilterHouse(e.target.value)}>
              <option value="">כל בתי ההשקעות</option>
              {uniqueHouses.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          )}
          {(filterType || filterHouse) && (
            <button className="filter-clear" onClick={() => { setFilterType(''); setFilterHouse(''); }}>✕ נקה</button>
          )}
        </div>
      )}

      {/* Desktop table */}
      <div className="card inv-table-card desktop-only">
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>שם</th><th>מסלול</th><th>בית השקעות</th><th>מס' נייר</th>
                <th>שווי עדכני</th><th>סה"כ הפקדות</th><th>רווח</th><th>תשואה</th>
                <th>% מהתיק</th><th>דמי ניהול</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filteredInvestments.map(inv => {
                const isProvident = inv.entryType === 'provident';
                const isUSDInv = inv.currency === 'USD';
                const currentVal = calcCurrentValue(inv);
                const deposits = getDeposits(inv);
                const profit = calcProfit(inv);
                const ret = calcReturn(inv);
                const portPct = currentVal !== null && totalCurrentValue > 0
                  ? ((currentVal / totalCurrentValue) * 100).toFixed(1) : null;
                return (
                  <tr key={inv.id}>
                    <td>
                      <strong>{inv.name}</strong>
                      {isProvident && <span className="provident-tag">קופ"ג</span>}
                      {isUSDInv && <span className="usd-tag">USD</span>}
                    </td>
                    <td><span className="badge inv-badge">{inv.type}</span></td>
                    <td>{inv.investmentHouse || '—'}</td>
                    <td>{inv.securityNumber ? <span className="ticker-badge">{inv.securityNumber}</span> : <span className="no-ticker">—</span>}</td>
                    <td className="num">
                      {currentVal !== null ? `₪${fmt(currentVal)}` : '—'}
                      {isUSDInv && inv.currentValueUSD ? <div style={{fontSize:'0.75rem',color:'#888'}}>${Number(inv.currentValueUSD).toLocaleString('en-US')}</div> : null}
                    </td>
                    <td className="num">₪{fmt(deposits)}</td>
                    <td className={profit !== null ? (profit >= 0 ? 'positive' : 'negative') : ''}>{profit !== null ? `${profit >= 0 ? '+' : ''}₪${fmt(profit)}` : '—'}</td>
                    <td className={ret !== null ? (ret >= 0 ? 'positive' : 'negative') : ''}>{ret !== null ? `${ret >= 0 ? '+' : ''}${fmtDec(ret)}%` : '—'}</td>
                    <td className="num">{portPct !== null ? `${portPct}%` : '—'}</td>
                    <td className="num">{pct(inv.accumulationFee)}</td>
                    <td className="actions-cell">
                      <button className="icon-btn" onClick={() => openEdit(inv)}>✏️</button>
                      <button className="icon-btn" onClick={() => handleDelete(inv.id)}>🗑️</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {filteredInvestments.length > 0 && (
              <tfoot>
                <tr className="total-row">
                  <td colSpan={4}><strong>סה"כ{(filterType || filterHouse) ? ' (מסונן)' : ''}</strong></td>
                  <td className="num"><strong>₪{fmt(filteredCurrentValue)}</strong></td>
                  <td className="num"><strong>₪{fmt(filteredDeposits)}</strong></td>
                  <td className={filteredProfit >= 0 ? 'positive' : 'negative'}><strong>{filteredValuedDeposits > 0 ? `${filteredProfit >= 0 ? '+' : ''}₪${fmt(filteredProfit)}` : '—'}</strong></td>
                  <td className={filteredReturn !== null && filteredReturn >= 0 ? 'positive' : 'negative'}><strong>{filteredReturn !== null ? `${filteredReturn >= 0 ? '+' : ''}${fmtDec(filteredReturn)}%` : '—'}</strong></td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {state.investments.length === 0 && (
          <div className="empty-state"><p>אין השקעות עדיין</p><button className="btn btn-primary" onClick={openAdd}>הוסף השקעה ראשונה</button></div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="mobile-only">
        {sortedInvestments.length === 0 && (
          <div className="empty-state"><p>אין השקעות עדיין</p><button className="btn btn-primary" onClick={openAdd}>הוסף השקעה ראשונה</button></div>
        )}
        {filteredInvestments.map(inv => {
          const isProvident = inv.entryType === 'provident';
          const isUSDInv = inv.currency === 'USD';
          const currentVal = calcCurrentValue(inv);
          const deposits = getDeposits(inv);
          const profit = calcProfit(inv);
          const ret = calcReturn(inv);
          return (
            <div key={inv.id} className="mcard">
              <div className="mcard-header">
                <span className="mcard-name">
                  {inv.name}
                  {isProvident && <span className="provident-tag">קופ"ג</span>}
                  {isUSDInv && <span className="usd-tag">USD</span>}
                </span>
                {inv.securityNumber && <span className="ticker-badge">{inv.securityNumber}</span>}
                {inv.type && <span className="badge inv-badge">{inv.type}</span>}
                <div className="mcard-actions">
                  <button className="icon-btn" onClick={() => openEdit(inv)}>✏️</button>
                  <button className="icon-btn" onClick={() => handleDelete(inv.id)}>🗑️</button>
                </div>
              </div>
              <div className="mcard-row">
                <div className="mcard-stat">
                  <span className="mcard-label">שווי עדכני</span>
                  <span className="mcard-value">{currentVal !== null ? `₪${fmt(currentVal)}` : '—'}</span>
                  {isUSDInv && inv.currentValueUSD ? <span style={{fontSize:'0.72rem',color:'#888'}}>${Number(inv.currentValueUSD).toLocaleString('en-US')}</span> : null}
                </div>
                <div className="mcard-stat">
                  <span className="mcard-label">סה"כ הפקדות</span>
                  <span className="mcard-value">₪{fmt(deposits)}</span>
                </div>
              </div>
              <div className="mcard-row">
                <div className="mcard-stat">
                  <span className="mcard-label">רווח</span>
                  <span className={`mcard-value ${profit !== null ? (profit >= 0 ? 'positive' : 'negative') : ''}`}>
                    {profit !== null ? `${profit >= 0 ? '+' : ''}₪${fmt(profit)}` : '—'}
                  </span>
                </div>
                <div className="mcard-stat">
                  <span className="mcard-label">תשואה</span>
                  <span className={`mcard-value ${ret !== null ? (ret >= 0 ? 'positive' : 'negative') : ''}`}>
                    {ret !== null ? `${ret >= 0 ? '+' : ''}${fmtDec(ret)}%` : '—'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        {filteredInvestments.length > 0 && (
          <div className="mcard-total">
            <span>שווי{(filterType || filterHouse) ? ' (מסונן)' : ' תיק'}</span>
            <span>₪{fmt(filteredCurrentValue)}</span>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <Modal title={editing ? 'עריכת השקעה' : 'השקעה חדשה'} onClose={closeModal}>
          <form onSubmit={handleSubmit}>

            {/* Currency toggle */}
            <div className="entry-type-toggle" style={{ marginBottom: 16 }}>
              <button type="button" className={`toggle-btn ${!isUSD ? 'active' : ''}`}
                onClick={() => setForm(f => ({ ...f, currency: 'ILS' }))}>
                ₪ שקלים
              </button>
              <button type="button" className={`toggle-btn ${isUSD ? 'active' : ''}`}
                onClick={() => setForm(f => ({ ...f, currency: 'USD' }))}>
                $ דולרים (USD)
              </button>
            </div>

            {/* ILS: entry type toggle */}
            {!isUSD && (
              <div className="entry-type-toggle">
                <button type="button" className={`toggle-btn ${isSecurity ? 'active' : ''}`}
                  onClick={() => setForm(f => ({ ...f, entryType: 'security' }))}>נייר ערך</button>
                <button type="button" className={`toggle-btn ${!isSecurity ? 'active' : ''}`}
                  onClick={() => setForm(f => ({ ...f, entryType: 'provident' }))}>קופת גמל להשקעה</button>
              </div>
            )}

            <FormField label="שם">
              <Input name="name" value={form.name} onChange={handleChange}
                placeholder={isUSD ? 'Apple, Tesla...' : isSecurity ? 'שם קרן / נייר ערך' : 'שם קופת הגמל'} required />
            </FormField>
            <FormField label="מסלול">
              <Input name="type" value={form.type} onChange={handleChange}
                placeholder="מדד עולמי, ביטקוין..." list="inv-types-list" />
              <datalist id="inv-types-list">
                {SUGGESTED_TYPES.map(t => <option key={t} value={t} />)}
              </datalist>
            </FormField>
            <FormField label="בית השקעות / חברה מנהלת">
              <Input name="investmentHouse" value={form.investmentHouse} onChange={handleChange}
                placeholder={isUSD ? 'Blink, Interactive Brokers...' : 'מור, מיטב, הראל...'} />
            </FormField>
            <FormField label="מספר נייר / טיקר">
              <Input name="securityNumber" value={form.securityNumber} onChange={handleChange}
                placeholder={isUSD ? 'AAPL, TSLA...' : 'מספר נייר ערך'} />
            </FormField>
            <FormField label="דמי ניהול (%)">
              <Input name="accumulationFee" type="number" step="0.01" value={form.accumulationFee}
                onChange={handleChange} placeholder="0.00" />
            </FormField>

            {/* USD fields */}
            {isUSD && (
              <>
                <div className="usd-section">
                  <div className="usd-section-title">שווי נוכחי</div>
                  <FormField label="שווי נוכחי ($)">
                    <Input name="currentValueUSD" type="number" step="0.01" value={form.currentValueUSD}
                      onChange={handleChange} placeholder="0.00" min="0" />
                  </FormField>
                  <div className="rate-row">
                    <FormField label="שער דולר (₪/$)">
                      <Input name="currentExchangeRate" type="number" step="0.001" value={form.currentExchangeRate}
                        onChange={handleChange} placeholder="0.000" min="0" />
                    </FormField>
                    <button type="button" className="btn btn-secondary rate-fetch-btn"
                      onClick={fetchCurrentRate} disabled={rateLoading}>
                      {rateLoading ? '...' : '🔄 שלוף שער'}
                    </button>
                  </div>
                  {rateError && <div className="lot-error">{rateError}</div>}
                  {currentILS && (
                    <div className="rate-preview">
                      שווי בשקלים: <strong>₪{fmt(currentILS)}</strong>
                    </div>
                  )}
                </div>

                <div className="usd-section">
                  <div className="usd-section-title">
                    קניות
                    {lotsTotal > 0 && <span className="lots-total"> — סה"כ הפקדות: ₪{fmt(lotsTotal)}</span>}
                  </div>
                  {pendingLots.length > 0 && (
                    <div className="lots-list">
                      <div className="lots-header">
                        <span>תאריך</span><span>סכום $</span><span>שער</span><span>₪</span><span></span>
                      </div>
                      {pendingLots.map(lot => (
                        <LotRow key={lot.id} lot={lot} onDelete={handleDeleteLot} />
                      ))}
                    </div>
                  )}
                  <AddLotForm onAdd={handleAddLot} />
                </div>
              </>
            )}

            {/* ILS fields */}
            {!isUSD && (
              <>
                <FormField label={'סה"כ הפקדות (₪)'}>
                  <Input name="totalDeposits" type="number" step="0.01" value={form.totalDeposits}
                    onChange={handleChange} placeholder="0" min="0" required />
                </FormField>
                {isSecurity ? (
                  <>
                    <FormField label="כמות יחידות">
                      <Input name="unitCount" type="number" step="any" value={form.unitCount}
                        onChange={handleChange} placeholder="0 (שברים מותרים)" min="0" />
                    </FormField>
                    <FormField label="שווי יחידה (אגורות)">
                      <Input name="unitPriceAgorot" type="number" step="0.01" value={form.unitPriceAgorot}
                        onChange={handleChange} placeholder="לדוגמה: 15000 = ₪150" />
                      {form.unitPriceAgorot > 0 && (
                        <div className="field-hint">= ₪{fmtDec(Number(form.unitPriceAgorot) / 100, 2)} ליחידה</div>
                      )}
                    </FormField>
                  </>
                ) : (
                  <FormField label="שווי עדכני של הקופה (₪)">
                    <Input name="currentValue" type="number" step="0.01" value={form.currentValue}
                      onChange={handleChange} placeholder="0" min="0" />
                  </FormField>
                )}
              </>
            )}

            <FormActions onCancel={closeModal} submitLabel={editing ? 'עדכן' : 'הוסף'} />
          </form>
        </Modal>
      )}
    </div>
  );
}
