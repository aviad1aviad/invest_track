import React from 'react';
import './FormField.css';

export function FormField({ label, children }) {
  return (
    <div className="form-field">
      <label className="form-label">{label}</label>
      {children}
    </div>
  );
}

export function Input({ ...props }) {
  return <input className="form-input" {...props} />;
}

export function Select({ children, ...props }) {
  return (
    <select className="form-input" {...props}>
      {children}
    </select>
  );
}

export function FormActions({ onCancel, submitLabel = 'שמור' }) {
  return (
    <div className="form-actions">
      <button type="button" className="btn btn-ghost" onClick={onCancel}>ביטול</button>
      <button type="submit" className="btn btn-primary">{submitLabel}</button>
    </div>
  );
}
