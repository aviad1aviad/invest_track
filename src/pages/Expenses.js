import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import Modal from '../components/common/Modal';
import { FormField, Input, FormActions } from '../components/common/FormField';
import InsightsCard from '../components/common/InsightsCard';
import { getExpenseInsights } from '../utils/insights';
import './Page.css';
import './Expenses.css';

const DOMAINS = ['דיור', 'בית', 'אוכל', 'בריאות', 'חינוך', 'חוגים', 'תחבורה', 'תקשורת', 'שונות', 'תיק השקעות'];
const PAYMENT_METHODS = ["צ'ק", 'כרטיס אשראי', 'הוראת קבע', 'העברה בנקאית'];

const FOOD_DOMAIN = 'אוכל';
const SAVINGS_DOMAIN = 'תיק השקעות';

const EMPTY_FORM = { domain: 'דיור', name: '', amount: '', paymentMethod: '', paymentEntity: '' };

function fmt(n) { return Number(n).toLocaleString('he-IL'); }

export default function Expenses() {
  const { state, dispatch } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = (exp) => { setEditing(exp); setForm({ ...exp }); setShowModal(true); };
  const closeModal = () => setShowModal(false);
  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = e => {
    e.preventDefault();
    const payload = { ...form, amount: Number(form.amount) };
    if (editing) {
      dispatch({ type: 'UPDATE_EXPENSE', payload: { ...payload, id: editing.id } });
    } else {
      dispatch({ type: 'ADD_EXPENSE', payload });
    }
    closeModal();
  };

  const handleDelete = id => {
    if (window.confirm('למחוק הוצאה זו?')) dispatch({ type: 'DELETE_EXPENSE', payload: id });
  };

  const allDomains = [
    ...DOMAINS,
    ...state.expenses.map(e => e.domain).filter(d => d && !DOMAINS.includes(d)),
  ].filter((d, i, arr) => arr.indexOf(d) === i);

  const byDomain = allDomains.reduce((acc, d) => {
    acc[d] = state.expenses.filter(e => e.domain === d);
    return acc;
  }, {});

  const domainTotal = d => (byDomain[d] || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const grandTotal = state.expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const foodTotal = domainTotal(FOOD_DOMAIN);
  const savingsTotal = domainTotal(SAVINGS_DOMAIN);
  const baseTotal = grandTotal - foodTotal - savingsTotal;

  const activeDomains = allDomains.filter(d => (byDomain[d] || []).length > 0);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">הוצאות קבועות</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ הוצאה חדשה</button>
      </div>

      {/* Mini-dashboard */}
      {state.expenses.length > 0 && (
        <div className="exp-kpi-row">
          <div className="exp-kpi-card">
            <div className="exp-kpi-label">ללא אוכל וחיסכון</div>
            <div className="exp-kpi-value">₪{fmt(baseTotal)}</div>
            <div className="exp-kpi-sub">הוצאות בסיס</div>
          </div>
          <div className="exp-kpi-card food">
            <div className="exp-kpi-label">+ אוכל</div>
            <div className="exp-kpi-value">₪{fmt(baseTotal + foodTotal)}</div>
            <div className="exp-kpi-sub">בסיס + אוכל</div>
          </div>
          <div className="exp-kpi-card savings">
            <div className="exp-kpi-label">+ חיסכון</div>
            <div className="exp-kpi-value">₪{fmt(grandTotal)}</div>
            <div className="exp-kpi-sub">סה"כ כולל הכל</div>
          </div>
        </div>
      )}

      {state.expenses.length > 0 && (
        <InsightsCard insights={getExpenseInsights(state.expenses)} />
      )}

      <div className="summary-bar">
        <div className="summary-total">
          <span className="summary-label">סה"כ חודשי</span>
          <span className="summary-value">₪{fmt(grandTotal)}</span>
        </div>
        <div className="domain-pills">
          {activeDomains.map(d => (
            <div key={d} className="domain-pill">
              <span className="pill-domain">{d}</span>
              <span className="pill-amount">₪{fmt(domainTotal(d))}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Desktop: tables per domain */}
      <div className="desktop-only">
        {activeDomains.map(domain => {
          const rows = byDomain[domain] || [];
          return (
            <div key={domain} className="domain-section">
              <div className="domain-header">
                <span className="domain-name">{domain}</span>
                <span className="domain-total">₪{fmt(domainTotal(domain))}</span>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>הוצאה</th><th>כמות</th><th>אמצעי תשלום</th><th>גורם</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(exp => (
                    <tr key={exp.id}>
                      <td>{exp.name}</td>
                      <td className="num">₪{fmt(exp.amount)}</td>
                      <td>{exp.paymentMethod}</td>
                      <td>{exp.paymentEntity}</td>
                      <td className="actions-cell">
                        <button className="icon-btn" onClick={() => openEdit(exp)}>✏️</button>
                        <button className="icon-btn" onClick={() => handleDelete(exp.id)}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>

      {/* Mobile: cards per domain */}
      <div className="mobile-only">
        {activeDomains.map(domain => {
          const rows = byDomain[domain] || [];
          return (
            <div key={domain} className="exp-mobile-domain">
              <div className="domain-header">
                <span className="domain-name">{domain}</span>
                <span className="domain-total">₪{fmt(domainTotal(domain))}</span>
              </div>
              {rows.map(exp => (
                <div key={exp.id} className="exp-mcard">
                  <div className="exp-mcard-main">
                    <span className="exp-mcard-name">{exp.name}</span>
                    <span className="exp-mcard-amount">₪{fmt(exp.amount)}</span>
                    <div className="mcard-actions">
                      <button className="icon-btn" onClick={() => openEdit(exp)}>✏️</button>
                      <button className="icon-btn" onClick={() => handleDelete(exp.id)}>🗑️</button>
                    </div>
                  </div>
                  {(exp.paymentMethod || exp.paymentEntity) && (
                    <div className="exp-mcard-sub">
                      {exp.paymentMethod && <span>{exp.paymentMethod}</span>}
                      {exp.paymentMethod && exp.paymentEntity && <span> · </span>}
                      {exp.paymentEntity && <span>{exp.paymentEntity}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })}
        {state.expenses.length > 0 && (
          <div className="mcard-total">
            <span>סה"כ חודשי</span>
            <span>₪{fmt(grandTotal)}</span>
          </div>
        )}
      </div>

      {state.expenses.length === 0 && (
        <div className="empty-state">
          <p>אין הוצאות קבועות עדיין</p>
          <button className="btn btn-primary" onClick={openAdd}>הוסף הוצאה ראשונה</button>
        </div>
      )}

      {showModal && (
        <Modal title={editing ? 'עריכת הוצאה' : 'הוצאה חדשה'} onClose={closeModal}>
          <form onSubmit={handleSubmit}>
            <FormField label="תחום">
              <Input name="domain" value={form.domain} onChange={handleChange}
                placeholder="דיור, אוכל, תחבורה..." list="domains-list" required />
              <datalist id="domains-list">
                {DOMAINS.map(d => <option key={d} value={d} />)}
              </datalist>
            </FormField>
            <FormField label="שם הוצאה">
              <Input name="name" value={form.name} onChange={handleChange} placeholder="שם הוצאה" required />
            </FormField>
            <FormField label="סכום (₪)">
              <Input name="amount" type="number" value={form.amount} onChange={handleChange} placeholder="0" min="0" required />
            </FormField>
            <FormField label="אמצעי תשלום">
              <Input name="paymentMethod" value={form.paymentMethod} onChange={handleChange}
                placeholder="כרטיס אשראי, הוראת קבע..." list="payment-methods-list" />
              <datalist id="payment-methods-list">
                {PAYMENT_METHODS.map(m => <option key={m} value={m} />)}
              </datalist>
            </FormField>
            <FormField label="גורם (בנק / חברת אשראי)">
              <Input name="paymentEntity" value={form.paymentEntity} onChange={handleChange} placeholder="לדוגמה: ויזה, הפועלים" />
            </FormField>
            <FormActions onCancel={closeModal} submitLabel={editing ? 'עדכן' : 'הוסף'} />
          </form>
        </Modal>
      )}
    </div>
  );
}
