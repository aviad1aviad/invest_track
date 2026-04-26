import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import Modal from '../components/common/Modal';
import { FormField, Input, FormActions } from '../components/common/FormField';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import './Page.css';
import './Investments.css';

const SUGGESTED_TYPES = ['מדד עולמי', 'מסלול מניות סחיר', 'ת"א 125', 'קרן גידור', 'ביטקוין', 'קרן כספית'];
const COLORS = ['#4361ee', '#f7932a', '#b5b5b5', '#3ecf8e', '#f7ae3a', '#e94560', '#a259ff'];

const EMPTY_FORM = {
  name: '',
  type: '',
  securityNumber: '',
  investmentHouse: '',
  managingCompany: '',
  totalDeposits: '',
  unitCount: '',
  unitPriceAgorot: '',
  accumulationFee: '',
};

function fmt(n) { return Number(n).toLocaleString('he-IL'); }
function fmtDec(n, d = 2) { return Number(n).toLocaleString('he-IL', { minimumFractionDigits: d, maximumFractionDigits: d }); }
function pct(n) { return n !== '' && n !== undefined && n !== 0 ? `${Number(n).toFixed(3)}%` : '—'; }

// TASE prices are in agorot — divide by 100 for shekel value
function calcCurrentValue(inv) {
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
  const openEdit = inv => { setEditing(inv); setForm({ ...inv }); setShowModal(true); };
  const closeModal = () => setShowModal(false);
  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = e => {
    e.preventDefault();
    const payload = {
      ...form,
      totalDeposits: Number(form.totalDeposits),
      unitCount: Number(form.unitCount),
      unitPriceAgorot: Number(form.unitPriceAgorot),
      accumulationFee: Number(form.accumulationFee),
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
  })).filter(d => d.value > 0);

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
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}>
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

      <div className="card inv-table-card">
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>שם</th>
                <th>סוג</th>
                <th>בית השקעות</th>
                <th>מס' נייר</th>
                <th>כמות יחידות</th>
                <th>שווי יחידה (אג')</th>
                <th>שווי עדכני</th>
                <th>סה"כ הפקדות</th>
                <th>רווח</th>
                <th>תשואה</th>
                <th>% מהתיק</th>
                <th>דמי ניהול</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {state.investments.map(inv => {
                const currentVal = calcCurrentValue(inv);
                const profit = calcProfit(inv);
                const ret = calcReturn(inv);
                const portPct = currentVal !== null && totalCurrentValue > 0
                  ? ((currentVal / totalCurrentValue) * 100).toFixed(1)
                  : null;
                return (
                  <tr key={inv.id}>
                    <td><strong>{inv.name}</strong></td>
                    <td><span className="badge inv-badge">{inv.type}</span></td>
                    <td>{inv.investmentHouse || '—'}</td>
                    <td>
                      {inv.securityNumber
                        ? <span className="ticker-badge">{inv.securityNumber}</span>
                        : <span className="no-ticker">—</span>}
                    </td>
                    <td className="num">{inv.unitCount ? fmt(Math.round(Number(inv.unitCount))) : '—'}</td>
                    <td className="num">{inv.unitPriceAgorot ? fmtDec(Number(inv.unitPriceAgorot), 2) : '—'}</td>
                    <td className="num">{currentVal !== null ? `₪${fmt(currentVal)}` : '—'}</td>
                    <td className="num">₪{fmt(inv.totalDeposits)}</td>
                    <td className={profit !== null ? (profit >= 0 ? 'positive' : 'negative') : ''}>
                      {profit !== null ? `${profit >= 0 ? '+' : ''}₪${fmt(profit)}` : '—'}
                    </td>
                    <td className={ret !== null ? (ret >= 0 ? 'positive' : 'negative') : ''}>
                      {ret !== null ? `${ret >= 0 ? '+' : ''}${fmtDec(ret)}%` : '—'}
                    </td>
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
                  <td className={totalProfit >= 0 ? 'positive' : 'negative'}>
                    <strong>{valuedDeposits > 0 ? `${totalProfit >= 0 ? '+' : ''}₪${fmt(totalProfit)}` : '—'}</strong>
                  </td>
                  <td className={totalReturn !== null && totalReturn >= 0 ? 'positive' : 'negative'}>
                    <strong>{totalReturn !== null ? `${totalReturn >= 0 ? '+' : ''}${fmtDec(totalReturn)}%` : '—'}</strong>
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {state.investments.length === 0 && (
          <div className="empty-state">
            <p>אין השקעות עדיין</p>
            <button className="btn btn-primary" onClick={openAdd}>הוסף השקעה ראשונה</button>
          </div>
        )}
      </div>

      {showModal && (
        <Modal title={editing ? 'עריכת השקעה' : 'השקעה חדשה'} onClose={closeModal}>
          <form onSubmit={handleSubmit}>
            <FormField label="שם">
              <Input name="name" value={form.name} onChange={handleChange} placeholder="שם קרן / נייר ערך" required />
            </FormField>
            <FormField label="סוג השקעה">
              <Input name="type" value={form.type} onChange={handleChange} placeholder="מדד עולמי, ביטקוין..." list="inv-types-list" />
              <datalist id="inv-types-list">
                {SUGGESTED_TYPES.map(t => <option key={t} value={t} />)}
              </datalist>
            </FormField>
            <FormField label="בית השקעות">
              <Input name="investmentHouse" value={form.investmentHouse} onChange={handleChange} placeholder="מיטב, אינבסקו, הראל..." />
            </FormField>
            <FormField label="חברה מנהלת">
              <Input name="managingCompany" value={form.managingCompany} onChange={handleChange} placeholder="חברה מנהלת" />
            </FormField>
            <FormField label="מספר נייר">
              <Input name="securityNumber" value={form.securityNumber} onChange={handleChange} placeholder="מספר נייר ערך" />
            </FormField>
            <FormField label={'סה"כ הפקדות (₪)'}>
              <Input name="totalDeposits" type="number" step="0.01" value={form.totalDeposits} onChange={handleChange} placeholder="0" min="0" required />
            </FormField>
            <FormField label="כמות יחידות">
              <Input name="unitCount" type="number" step="1" value={form.unitCount} onChange={handleChange} placeholder="0" min="0" />
            </FormField>
            <FormField label="שווי יחידה (אגורות)">
              <Input name="unitPriceAgorot" type="number" step="0.01" value={form.unitPriceAgorot} onChange={handleChange} placeholder="לדוגמה: 15000 = ₪150" />
              {form.unitPriceAgorot > 0 && (
                <div className="field-hint">= ₪{fmtDec(Number(form.unitPriceAgorot) / 100, 2)} ליחידה</div>
              )}
            </FormField>
            <FormField label="דמי ניהול צבירה (%)">
              <Input name="accumulationFee" type="number" step="0.01" value={form.accumulationFee} onChange={handleChange} placeholder="0.00" />
            </FormField>
            <FormActions onCancel={closeModal} submitLabel={editing ? 'עדכן' : 'הוסף'} />
          </form>
        </Modal>
      )}
    </div>
  );
}
