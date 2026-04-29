import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import Modal from '../components/common/Modal';
import { FormField, Input, FormActions } from '../components/common/FormField';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import InsightsCard from '../components/common/InsightsCard';
import { getInvestmentInsights } from '../utils/insights';
import './Page.css';
import './Investments.css';

const SUGGESTED_TYPES = ['מדד עולמי', 'מסלול מניות סחיר', 'ת"א 125', 'קרן גידור', 'ביטקוין', 'קרן כספית'];
const COLORS = ['#4361ee', '#f7932a', '#b5b5b5', '#3ecf8e', '#f7ae3a', '#e94560', '#a259ff'];

const EMPTY_FORM = {
  entryType: 'security',
  name: '',
  type: '',
  securityNumber: '',
  investmentHouse: '',
  managingCompany: '',
  totalDeposits: '',
  // security fields
  unitCount: '',
  unitPriceAgorot: '',
  // provident fund fields
  currentValue: '',
  accumulationFee: '',
};

function fmt(n) { return Number(n).toLocaleString('he-IL'); }
function fmtDec(n, d = 2) { return Number(n).toLocaleString('he-IL', { minimumFractionDigits: d, maximumFractionDigits: d }); }
function pct(n) { return n !== '' && n !== undefined && n !== 0 ? `${Number(n).toFixed(3)}%` : '—'; }

function calcCurrentValue(inv) {
  if (inv.entryType === 'provident') {
    const val = Number(inv.currentValue) || 0;
    return val > 0 ? val : null;
  }
  const units = Number(inv.unitCount) || 0;
  const agorot = Number(inv.unitPriceAgorot) || 0;
  if (!units || !agorot) return null;
  return (units * agorot) / 100;
}

function calcProfit(inv) {
  const val = calcCurrentValue(inv);
  if (val === null) return null;
  return val - (Number(inv.totalDeposits) || 0);
}

function calcReturn(inv) {
  const deposits = Number(inv.totalDeposits) || 0;
  const profit = calcProfit(inv);
  if (!deposits || profit === null) return null;
  return (profit / deposits) * 100;
}

export default function Investments() {
  const { state, dispatch } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = inv => { setEditing(inv); setForm({ entryType: inv.entryType || 'security', ...inv }); setShowModal(true); };
  const closeModal = () => setShowModal(false);
  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = e => {
    e.preventDefault();
    const payload = {
      ...form,
      totalDeposits: Number(form.totalDeposits),
      accumulationFee: Number(form.accumulationFee),
      ...(form.entryType === 'security'
        ? { unitCount: Number(form.unitCount), unitPriceAgorot: Number(form.unitPriceAgorot), currentValue: 0 }
        : { currentValue: Number(form.currentValue), unitCount: 0, unitPriceAgorot: 0 }
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
  const totalDeposits = state.investments.reduce((s, inv) => s + (Number(inv.totalDeposits) || 0), 0);
  const valuedDeposits = state.investments
    .filter(inv => calcCurrentValue(inv) !== null)
    .reduce((s, inv) => s + (Number(inv.totalDeposits) || 0), 0);
  const totalProfit = totalCurrentValue - valuedDeposits;
  const totalReturn = valuedDeposits > 0 ? (totalProfit / valuedDeposits) * 100 : null;

  const allTypes = [...new Set(state.investments.map(inv => inv.type).filter(Boolean))];
  const pieData = allTypes.map((t, i) => ({
    name: t,
    value: state.investments.filter(inv => inv.type === t).reduce((s, inv) => s + (calcCurrentValue(inv) ?? 0), 0),
    color: COLORS[i % COLORS.length],
  })).filter(d => d.value > 0).sort((a, b) => b.value - a.value);

  const sortedInvestments = [...state.investments].sort((a, b) => (calcCurrentValue(b) ?? 0) - (calcCurrentValue(a) ?? 0));

  const isSecurity = form.entryType === 'security';

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
          <div className="big-number secondary">₪{fmt(totalDeposits)}</div>
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
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                  innerRadius={50} outerRadius={90}>
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

      {/* Desktop table */}
      <div className="card inv-table-card desktop-only">
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>שם</th><th>סוג</th><th>בית השקעות</th><th>מס' נייר</th>
                <th>כמות יחידות</th><th>שווי יחידה (אג')</th><th>שווי עדכני</th>
                <th>סה"כ הפקדות</th><th>רווח</th><th>תשואה</th><th>% מהתיק</th><th>דמי ניהול</th><th></th>
              </tr>
            </thead>
            <tbody>
              {sortedInvestments.map(inv => {
                const isProvident = inv.entryType === 'provident';
                const currentVal = calcCurrentValue(inv);
                const profit = calcProfit(inv);
                const ret = calcReturn(inv);
                const portPct = currentVal !== null && totalCurrentValue > 0
                  ? ((currentVal / totalCurrentValue) * 100).toFixed(1) : null;
                return (
                  <tr key={inv.id}>
                    <td><strong>{inv.name}</strong>{isProvident && <span className="provident-tag">קופ"ג</span>}</td>
                    <td><span className="badge inv-badge">{inv.type}</span></td>
                    <td>{inv.investmentHouse || '—'}</td>
                    <td>{inv.securityNumber ? <span className="ticker-badge">{inv.securityNumber}</span> : <span className="no-ticker">—</span>}</td>
                    <td className="num">{!isProvident && inv.unitCount ? fmt(Math.round(Number(inv.unitCount))) : '—'}</td>
                    <td className="num">{!isProvident && inv.unitPriceAgorot ? fmtDec(Number(inv.unitPriceAgorot), 2) : '—'}</td>
                    <td className="num">{currentVal !== null ? `₪${fmt(currentVal)}` : '—'}</td>
                    <td className="num">₪{fmt(inv.totalDeposits)}</td>
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
            {state.investments.length > 0 && (
              <tfoot>
                <tr className="total-row">
                  <td colSpan={6}><strong>סה"כ</strong></td>
                  <td className="num"><strong>₪{fmt(totalCurrentValue)}</strong></td>
                  <td className="num"><strong>₪{fmt(totalDeposits)}</strong></td>
                  <td className={totalProfit >= 0 ? 'positive' : 'negative'}><strong>{valuedDeposits > 0 ? `${totalProfit >= 0 ? '+' : ''}₪${fmt(totalProfit)}` : '—'}</strong></td>
                  <td className={totalReturn !== null && totalReturn >= 0 ? 'positive' : 'negative'}><strong>{totalReturn !== null ? `${totalReturn >= 0 ? '+' : ''}${fmtDec(totalReturn)}%` : '—'}</strong></td>
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
        {sortedInvestments.map(inv => {
          const isProvident = inv.entryType === 'provident';
          const currentVal = calcCurrentValue(inv);
          const profit = calcProfit(inv);
          const ret = calcReturn(inv);
          return (
            <div key={inv.id} className="mcard">
              <div className="mcard-header">
                <span className="mcard-name">{inv.name}{isProvident && <span className="provident-tag">קופ"ג</span>}</span>
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
                </div>
                <div className="mcard-stat">
                  <span className="mcard-label">סה"כ הפקדות</span>
                  <span className="mcard-value">₪{fmt(inv.totalDeposits)}</span>
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
        {sortedInvestments.length > 0 && (
          <div className="mcard-total">
            <span>שווי תיק</span><span>₪{fmt(totalCurrentValue)}</span>
          </div>
        )}
      </div>

      {showModal && (
        <Modal title={editing ? 'עריכת השקעה' : 'השקעה חדשה'} onClose={closeModal}>
          <form onSubmit={handleSubmit}>

            {/* Entry type toggle */}
            <div className="entry-type-toggle">
              <button
                type="button"
                className={`toggle-btn ${isSecurity ? 'active' : ''}`}
                onClick={() => setForm(f => ({ ...f, entryType: 'security' }))}
              >
                נייר ערך
              </button>
              <button
                type="button"
                className={`toggle-btn ${!isSecurity ? 'active' : ''}`}
                onClick={() => setForm(f => ({ ...f, entryType: 'provident' }))}
              >
                קופת גמל להשקעה
              </button>
            </div>

            <FormField label="שם">
              <Input name="name" value={form.name} onChange={handleChange}
                placeholder={isSecurity ? 'שם קרן / נייר ערך' : 'שם קופת הגמל'} required />
            </FormField>
            <FormField label="סוג השקעה">
              <Input name="type" value={form.type} onChange={handleChange}
                placeholder="מדד עולמי, ביטקוין..." list="inv-types-list" />
              <datalist id="inv-types-list">
                {SUGGESTED_TYPES.map(t => <option key={t} value={t} />)}
              </datalist>
            </FormField>
            <FormField label="בית השקעות / חברה מנהלת">
              <Input name="investmentHouse" value={form.investmentHouse} onChange={handleChange}
                placeholder="מור, מיטב, הראל..." />
            </FormField>

            {isSecurity && (
              <FormField label="מספר נייר">
                <Input name="securityNumber" value={form.securityNumber} onChange={handleChange}
                  placeholder="מספר נייר ערך" />
              </FormField>
            )}

            <FormField label={'סה"כ הפקדות (₪)'}>
              <Input name="totalDeposits" type="number" step="0.01" value={form.totalDeposits}
                onChange={handleChange} placeholder="0" min="0" required />
            </FormField>

            {isSecurity ? (
              <>
                <FormField label="כמות יחידות">
                  <Input name="unitCount" type="number" step="1" value={form.unitCount}
                    onChange={handleChange} placeholder="0" min="0" />
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

            <FormField label="דמי ניהול (%)">
              <Input name="accumulationFee" type="number" step="0.01" value={form.accumulationFee}
                onChange={handleChange} placeholder="0.00" />
            </FormField>

            <FormActions onCancel={closeModal} submitLabel={editing ? 'עדכן' : 'הוסף'} />
          </form>
        </Modal>
      )}
    </div>
  );
}
