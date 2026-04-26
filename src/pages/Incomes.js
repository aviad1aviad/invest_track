import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import Modal from '../components/common/Modal';
import { FormField, Input, FormActions } from '../components/common/FormField';
import './Page.css';
import './Incomes.css';

const SUGGESTED_DOMAINS = ['משכורת', 'פרילנס', 'שכירות', 'קצבה', 'מענק', 'דיבידנד', 'שונות'];

const EMPTY_FORM = { domain: '', name: '', amount: '' };

function fmt(n) { return Number(n).toLocaleString('he-IL'); }

export default function Incomes() {
  const { state, dispatch } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = inc => { setEditing(inc); setForm({ ...inc }); setShowModal(true); };
  const closeModal = () => setShowModal(false);
  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = e => {
    e.preventDefault();
    const payload = { ...form, amount: Number(form.amount) };
    if (editing) {
      dispatch({ type: 'UPDATE_INCOME', payload: { ...payload, id: editing.id } });
    } else {
      dispatch({ type: 'ADD_INCOME', payload });
    }
    closeModal();
  };

  const handleDelete = id => {
    if (window.confirm('למחוק הכנסה זו?')) dispatch({ type: 'DELETE_INCOME', payload: id });
  };

  const incomes = state.incomes || [];
  const grandTotal = incomes.reduce((s, i) => s + (Number(i.amount) || 0), 0);

  // Group by domain — suggestion list first, then any custom
  const allDomains = [
    ...SUGGESTED_DOMAINS,
    ...incomes.map(i => i.domain).filter(d => d && !SUGGESTED_DOMAINS.includes(d)),
  ].filter((d, i, arr) => arr.indexOf(d) === i);

  const byDomain = allDomains.reduce((acc, d) => {
    acc[d] = incomes.filter(i => i.domain === d);
    return acc;
  }, {});

  const domainTotal = d => (byDomain[d] || []).reduce((s, i) => s + (Number(i.amount) || 0), 0);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">הכנסות</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ הכנסה חדשה</button>
      </div>

      <div className="income-summary-bar">
        <div className="income-summary-total">
          <span className="income-summary-label">סה"כ הכנסות חודשיות</span>
          <span className="income-summary-value">₪{fmt(grandTotal)}</span>
        </div>
        <div className="income-domain-pills">
          {allDomains.filter(d => (byDomain[d] || []).length > 0).map(d => (
            <div key={d} className="income-pill">
              <span className="income-pill-domain">{d}</span>
              <span className="income-pill-amount">₪{fmt(domainTotal(d))}</span>
            </div>
          ))}
        </div>
      </div>

      {allDomains.map(domain => {
        const rows = byDomain[domain] || [];
        if (!rows.length) return null;
        return (
          <div key={domain} className="income-domain-section">
            <div className="income-domain-header">
              <span className="income-domain-name">{domain}</span>
              <span className="income-domain-total">₪{fmt(domainTotal(domain))}</span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>שם הכנסה</th>
                  <th>סכום חודשי</th>
                  <th>% מסה"כ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(inc => (
                  <tr key={inc.id}>
                    <td>{inc.name}</td>
                    <td className="num">₪{fmt(inc.amount)}</td>
                    <td className="num">{grandTotal > 0 ? ((Number(inc.amount) / grandTotal) * 100).toFixed(1) : 0}%</td>
                    <td className="actions-cell">
                      <button className="icon-btn" onClick={() => openEdit(inc)}>✏️</button>
                      <button className="icon-btn" onClick={() => handleDelete(inc.id)}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      {incomes.length === 0 && (
        <div className="empty-state">
          <p>אין הכנסות עדיין</p>
          <button className="btn btn-primary" onClick={openAdd}>הוסף הכנסה ראשונה</button>
        </div>
      )}

      {showModal && (
        <Modal title={editing ? 'עריכת הכנסה' : 'הכנסה חדשה'} onClose={closeModal}>
          <form onSubmit={handleSubmit}>
            <FormField label="תחום">
              <Input name="domain" value={form.domain} onChange={handleChange}
                placeholder="משכורת, פרילנס, שכירות..." list="income-domains-list" required />
              <datalist id="income-domains-list">
                {SUGGESTED_DOMAINS.map(d => <option key={d} value={d} />)}
              </datalist>
            </FormField>
            <FormField label="שם הכנסה">
              <Input name="name" value={form.name} onChange={handleChange}
                placeholder="שם ההכנסה" required />
            </FormField>
            <FormField label="סכום חודשי (₪)">
              <Input name="amount" type="number" value={form.amount} onChange={handleChange}
                placeholder="0" min="0" step="0.01" required />
            </FormField>
            <FormActions onCancel={closeModal} submitLabel={editing ? 'עדכן' : 'הוסף'} />
          </form>
        </Modal>
      )}
    </div>
  );
}
