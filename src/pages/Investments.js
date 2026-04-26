import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import Modal from '../components/common/Modal';
import { FormField, Input, FormActions } from '../components/common/FormField';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchPrices } from '../utils/priceService';
import './Page.css';
import './Investments.css';

const SUGGESTED_TYPES = ['מדד עולמי', 'מסלול מניות סחיר', 'ת"א 125', 'קרן גידור', 'ביטקוין', 'קרן כספית'];
const COLORS = ['#4361ee', '#f7932a', '#b5b5b5', '#3ecf8e', '#f7ae3a', '#e94560', '#a259ff'];

const EMPTY_FORM = {
  name: '',
  type: '',
  securityNumber: '',
  ticker: '',
  investmentHouse: '',
  managingCompany: '',
  totalDeposits: '',
  unitCount: '',
  unitPrice: '',
  accumulationFee: '',
};

function fmt(n) { return Number(n).toLocaleString('he-IL'); }
function fmtDec(n, d = 2) { return Number(n).toLocaleString('he-IL', { minimumFractionDigits: d, maximumFractionDigits: d }); }
function pct(n) { return n !== '' && n !== undefined ? `${Number(n).toFixed(2)}%` : '—'; }

function calcCurrentValue(inv) {
  const units = Number(inv.unitCount) || 0;
  const price = Number(inv.unitPrice) || 0;
  return units && price ? units * price : 0;
}

function calcProfit(inv) {
  return calcCurrentValue(inv) - (Number(inv.totalDeposits) || 0);
}

function calcReturn(inv) {
  const deposits = Number(inv.totalDeposits) || 0;
  if (!deposits) return null;
  return (calcProfit(inv) / deposits) * 100;
}

export default function Investments() {
  const { state, dispatch } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResults, setRefreshResults] = useState(null);

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
      unitPrice: Number(form.unitPrice),
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

  const handleRefreshPrices = async () => {
    const withTicker = state.investments.filter(inv => inv.ticker);
    if (!withTicker.length) {
      setRefreshResults({ updated: [], failed: [], noTicker: state.investments.length });
      return;
    }
    setRefreshing(true);
    setRefreshResults(null);
    try {
      const results = await fetchPrices(withTicker);
      const updated = [];
      const failed = [];
      results.forEach(r => {
        if (r.skipped) return;
        if (r.error) {
          failed.push({ name: state.investments.find(i => i.id === r.id)?.name, ticker: r.ticker, error: r.error });
        } else {
          const inv = state.investments.find(i => i.id === r.id);
          dispatch({ type: 'UPDATE_INVESTMENT', payload: { ...inv, unitPrice: r.price } });
          updated.push({ name: inv.name, ticker: r.ticker, price: r.price, currency: r.currency });
        }
      });
      setRefreshResults({ updated, failed });
    } finally {
      setRefreshing(false);
    }
  };

  const totalCurrentValue = state.investments.reduce((s, inv) => s + calcCurrentValue(inv), 0);
  const totalDeposits = state.investments.reduce((s, inv) => s + (Number(inv.totalDeposits) || 0), 0);
  const totalProfit = totalCurrentValue - totalDeposits;
  const totalReturn = totalDeposits > 0 ? (totalProfit / totalDeposits) * 100 : 0;

  const allTypes = [...new Set(state.investments.map(inv => inv.type).filter(Boolean))];
  const pieData = allTypes.map((t, i) => ({
    name: t,
    value: state.investments.filter(inv => inv.type === t).reduce((s, inv) => s + calcCurrentValue(inv), 0),
    color: COLORS[i % COLORS.length],
  })).filter(d => d.value > 0);

  const tickerCount = state.investments.filter(inv => inv.ticker).length;

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">השקעות</h1>
        <div className="page-header-actions">
          {state.investments.length > 0 && (
            <button
              className={`btn btn-refresh ${refreshing ? 'loading' : ''}`}
              onClick={handleRefreshPrices}
              disabled={refreshing}
              title={tickerCount === 0 ? 'אין ניירות עם טיקר מוגדר' : `רענן מחירים עבור ${tickerCount} ניירות`}
            >
              {refreshing ? '⏳ מושך מחירים...' : `🔄 רענן מחירים${tickerCount > 0 ? ` (${tickerCount})` : ''}`}
            </button>
          )}
          <button className="btn btn-primary" onClick={openAdd}>+ השקעה חדשה</button>
        </div>
      </div>

      {refreshResults && (
        <div className={`refresh-banner ${refreshResults.failed?.length ? 'has-errors' : 'success'}`}>
          {refreshResults.updated?.length > 0 && (
            <span className="refresh-ok">
              ✓ עודכנו {refreshResults.updated.length} ניירות:&nbsp;
              {refreshResults.updated.map(r => `${r.name} (${r.currency} ${fmtDec(r.price)})`).join(' · ')}
            </span>
          )}
          {refreshResults.failed?.length > 0 && (
            <span className="refresh-err">
              &nbsp;· ✗ נכשלו: {refreshResults.failed.map(r => `${r.name} [${r.ticker}] — ${r.error}`).join(', ')}
            </span>
          )}
          {refreshResults.updated?.length === 0 && !refreshResults.failed?.length && (
            <span>אין ניירות עם טיקר מוגדר — הוסף טיקר בעריכת ההשקעה</span>
          )}
          <button className="refresh-close" onClick={() => setRefreshResults(null)}>✕</button>
        </div>
      )}

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
            {totalProfit >= 0 ? '+' : ''}₪{fmt(totalProfit)}
          </div>
        </div>
        <div className="card stat-card">
          <div className="summary-label">תשואה כוללת</div>
          <div className={`big-number ${totalReturn >= 0 ? 'profit' : 'loss'}`}>
            {totalReturn >= 0 ? '+' : ''}{fmtDec(totalReturn)}%
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
                <th>טיקר</th>
                <th>כמות יחידות</th>
                <th>שווי יחידה</th>
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
                const portPct = totalCurrentValue > 0 ? ((currentVal / totalCurrentValue) * 100).toFixed(1) : 0;
                return (
                  <tr key={inv.id}>
                    <td><strong>{inv.name}</strong></td>
                    <td><span className="badge inv-badge">{inv.type}</span></td>
                    <td>{inv.investmentHouse || '—'}</td>
                    <td>
                      {inv.ticker
                        ? <span className="ticker-badge">{inv.ticker}</span>
                        : <span className="no-ticker">—</span>}
                    </td>
                    <td className="num">{inv.unitCount ? fmtDec(inv.unitCount, 4) : '—'}</td>
                    <td className="num">{inv.unitPrice ? `${fmtDec(inv.unitPrice, 2)}` : '—'}</td>
                    <td className="num">₪{fmt(currentVal)}</td>
                    <td className="num">₪{fmt(inv.totalDeposits)}</td>
                    <td className={profit >= 0 ? 'positive' : 'negative'}>
                      {profit >= 0 ? '+' : ''}₪{fmt(profit)}
                    </td>
                    <td className={ret !== null ? (ret >= 0 ? 'positive' : 'negative') : ''}>
                      {ret !== null ? `${ret >= 0 ? '+' : ''}${fmtDec(ret)}%` : '—'}
                    </td>
                    <td className="num">{portPct}%</td>
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
                    <strong>{totalProfit >= 0 ? '+' : ''}₪{fmt(totalProfit)}</strong>
                  </td>
                  <td className={totalReturn >= 0 ? 'positive' : 'negative'}>
                    <strong>{totalReturn >= 0 ? '+' : ''}{fmtDec(totalReturn)}%</strong>
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
            <FormField label="טיקר Yahoo Finance">
              <Input name="ticker" value={form.ticker} onChange={handleChange} placeholder="5122510.TA · BTC-USD · VWRL.L" />
              <div className="field-hint">לניירות ת"א: מספר נייר + .TA · לביטקוין: BTC-USD</div>
            </FormField>
            <FormField label={'סה"כ הפקדות (₪)'}>
              <Input name="totalDeposits" type="number" value={form.totalDeposits} onChange={handleChange} placeholder="0" min="0" required />
            </FormField>
            <FormField label="כמות יחידות">
              <Input name="unitCount" type="number" step="0.0001" value={form.unitCount} onChange={handleChange} placeholder="0" />
            </FormField>
            <FormField label="שווי יחידה">
              <Input name="unitPrice" type="number" step="0.01" value={form.unitPrice} onChange={handleChange} placeholder="0.00" />
            </FormField>
            <FormField label="דמי ניהול צבירה (%)">
              <Input name="accumulationFee" type="number" step="0.001" value={form.accumulationFee} onChange={handleChange} placeholder="0.000" />
            </FormField>
            <FormActions onCancel={closeModal} submitLabel={editing ? 'עדכן' : 'הוסף'} />
          </form>
        </Modal>
      )}
    </div>
  );
}
