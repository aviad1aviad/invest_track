import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import Modal from '../components/common/Modal';
import { FormField, Input, FormActions } from '../components/common/FormField';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import './Page.css';
import './Savings.css';

const SUGGESTED_TYPES = ['מסלול מניות', 'סנפ 500', 'קרן כספית', 'מסלול כללי', 'מסלול אג"ח'];
const COLORS = ['#4361ee', '#f7ae3a', '#b5b5b5', '#3ecf8e', '#e94560', '#a259ff', '#06d6a0', '#8ecae6'];

const EMPTY_FORM = {
  name: '',
  type: '',
  fundNumber: '',
  managingCompany: '',
  currentAmount: '',
  totalDeposits: '',
  depositFee: '',
  accumulationFee: '',
};

function fmt(n) { return Number(n).toLocaleString('he-IL'); }
function fmtDec(n, d = 2) { return Number(n).toLocaleString('he-IL', { minimumFractionDigits: d, maximumFractionDigits: d }); }
function pct(n) { return n !== '' && n !== undefined ? `${Number(n).toFixed(2)}%` : '—'; }

function calcReturn(s) {
  const current = Number(s.currentAmount) || 0;
  const deposits = Number(s.totalDeposits) || 0;
  if (!deposits) return null;
  return ((current - deposits) / deposits) * 100;
}

export default function Savings() {
  const { state, dispatch } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = s => { setEditing(s); setForm({ ...s }); setShowModal(true); };
  const closeModal = () => setShowModal(false);
  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = e => {
    e.preventDefault();
    const payload = {
      ...form,
      currentAmount: Number(form.currentAmount),
      totalDeposits: Number(form.totalDeposits),
      depositFee: Number(form.depositFee),
      accumulationFee: Number(form.accumulationFee),
    };
    if (editing) {
      dispatch({ type: 'UPDATE_SAVING', payload: { ...payload, id: editing.id } });
    } else {
      dispatch({ type: 'ADD_SAVING', payload });
    }
    closeModal();
  };

  const handleDelete = id => {
    if (window.confirm('למחוק חיסכון זה?')) dispatch({ type: 'DELETE_SAVING', payload: id });
  };

  const total = state.savings.reduce((s, sv) => s + (Number(sv.currentAmount) || 0), 0);

  // Dynamic types from actual data, sorted high→low
  const allTypes = [...new Set(state.savings.map(s => s.type).filter(Boolean))];
  const pieData = allTypes.map((t, i) => ({
    name: t,
    value: state.savings.filter(s => s.type === t).reduce((sum, s) => sum + (Number(s.currentAmount) || 0), 0),
    color: COLORS[i % COLORS.length],
  })).filter(d => d.value > 0).sort((a, b) => b.value - a.value);

  const sortedSavings = [...state.savings].sort((a, b) => (Number(b.currentAmount) || 0) - (Number(a.currentAmount) || 0));

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">חסכונות</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ חיסכון חדש</button>
      </div>

      <div className="savings-overview">
        <div className="card savings-total-card">
          <div className="summary-label">סה"כ חסכונות</div>
          <div className="big-number">₪{fmt(total)}</div>
          <div className="savings-type-breakdown">
            {pieData.map((entry, i) => {
              const pctVal = total > 0 ? ((entry.value / total) * 100).toFixed(1) : 0;
              return (
                <div key={entry.name} className="type-row">
                  <span className="type-dot" style={{ background: entry.color }} />
                  <span className="type-name">{entry.name}</span>
                  <span className="type-pct">{pctVal}%</span>
                  <span className="type-amount">₪{fmt(entry.value)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {pieData.length > 0 && (
          <div className="card savings-chart-card">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                  innerRadius={50} outerRadius={90}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={v => `₪${fmt(v)}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 0 }}>
        <div className="savings-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>שם קרן</th>
              <th>מסלול</th>
              <th>חברה מנהלת</th>
              <th>מס' קופה</th>
              <th>סכום עדכני</th>
              <th>סה"כ הפקדות</th>
              <th>רווח</th>
              <th>תשואה</th>
              <th>אחוז מהתיק</th>
              <th>דמי ניהול הפקדה</th>
              <th>דמי ניהול צבירה</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sortedSavings.map(s => {
              const ret = calcReturn(s);
              const profit = (Number(s.currentAmount) || 0) - (Number(s.totalDeposits) || 0);
              return (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong></td>
                  <td><span className="badge">{s.type}</span></td>
                  <td>{s.managingCompany || '—'}</td>
                  <td>{s.fundNumber || '—'}</td>
                  <td className="num">₪{fmt(s.currentAmount)}</td>
                  <td className="num">{s.totalDeposits ? `₪${fmt(s.totalDeposits)}` : '—'}</td>
                  <td className={profit >= 0 ? 'positive' : 'negative'}>
                    {s.totalDeposits ? `${profit >= 0 ? '+' : ''}₪${fmt(profit)}` : '—'}
                  </td>
                  <td className={ret !== null ? (ret >= 0 ? 'positive' : 'negative') : ''}>
                    {ret !== null ? `${ret >= 0 ? '+' : ''}${fmtDec(ret)}%` : '—'}
                  </td>
                  <td className="num">{total > 0 ? ((s.currentAmount / total) * 100).toFixed(1) : 0}%</td>
                  <td className="num">{pct(s.depositFee)}</td>
                  <td className="num">{pct(s.accumulationFee)}</td>
                  <td className="actions-cell">
                    <button className="icon-btn" onClick={() => openEdit(s)}>✏️</button>
                    <button className="icon-btn" onClick={() => handleDelete(s.id)}>🗑️</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {state.savings.length > 0 && (
            <tfoot>
              <tr className="total-row">
                <td colSpan={4}><strong>סה"כ</strong></td>
                <td className="num"><strong>₪{fmt(total)}</strong></td>
                <td colSpan={7} />
              </tr>
            </tfoot>
          )}
        </table>
        </div>
        {state.savings.length === 0 && (
          <div className="empty-state">
            <p>אין חסכונות עדיין</p>
            <button className="btn btn-primary" onClick={openAdd}>הוסף חיסכון ראשון</button>
          </div>
        )}
      </div>

      {showModal && (
        <Modal title={editing ? 'עריכת חיסכון' : 'חיסכון חדש'} onClose={closeModal}>
          <form onSubmit={handleSubmit}>
            <FormField label="שם קרן">
              <Input name="name" value={form.name} onChange={handleChange} placeholder="קרן פנסיה / השתלמות..." required />
            </FormField>
            <FormField label="מסלול">
              <Input
                name="type"
                value={form.type}
                onChange={handleChange}
                placeholder="מסלול מניות, סנפ 500..."
                list="savings-types-list"
              />
              <datalist id="savings-types-list">
                {SUGGESTED_TYPES.map(t => <option key={t} value={t} />)}
              </datalist>
            </FormField>
            <FormField label="חברה מנהלת">
              <Input name="managingCompany" value={form.managingCompany} onChange={handleChange} placeholder="מור, מגדל, אלטשולר..." />
            </FormField>
            <FormField label="מספר קופה">
              <Input name="fundNumber" value={form.fundNumber} onChange={handleChange} placeholder="מספר קופה (אופציונלי)" />
            </FormField>
            <FormField label="סכום עדכני (₪)">
              <Input name="currentAmount" type="number" value={form.currentAmount} onChange={handleChange} placeholder="0" min="0" required />
            </FormField>
            <FormField label={'סה"כ הפקדות (₪)'}>
              <Input name="totalDeposits" type="number" value={form.totalDeposits} onChange={handleChange} placeholder="0" min="0" />
            </FormField>
            <FormField label="דמי ניהול הפקדה (%)">
              <Input name="depositFee" type="number" step="0.01" value={form.depositFee} onChange={handleChange} placeholder="0.00" />
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
