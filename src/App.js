import React, { useState, useRef } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Savings from './pages/Savings';
import Investments from './pages/Investments';
import './App.css';

const TABS = [
  { id: 'dashboard', label: 'דשבורד', icon: '📊' },
  { id: 'expenses', label: 'הוצאות', icon: '💳' },
  { id: 'savings', label: 'חסכונות', icon: '🏦' },
  { id: 'investments', label: 'השקעות', icon: '📈' },
];

function DataControls() {
  const { state, dispatch } = useApp();
  const importRef = useRef();

  const handleExport = () => {
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invest-track-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.expenses || !data.savings || !data.investments) {
          alert('קובץ לא תקין');
          return;
        }
        if (window.confirm('ייבוא יחליף את כל הנתונים הקיימים. להמשיך?')) {
          dispatch({ type: 'LOAD', payload: data });
        }
      } catch {
        alert('שגיאה בקריאת הקובץ');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="data-controls">
      <button className="data-btn" onClick={handleExport} title="ייצא נתונים">
        ⬇ ייצוא
      </button>
      <button className="data-btn" onClick={() => importRef.current.click()} title="ייבא נתונים">
        ⬆ ייבוא
      </button>
      <input ref={importRef} type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
    </div>
  );
}

function AppInner() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderPage = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'expenses': return <Expenses />;
      case 'savings': return <Savings />;
      case 'investments': return <Investments />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="app" dir="rtl">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">📊</span>
          <span className="brand-name">ניהול כלכלי</span>
        </div>
        <nav className="sidebar-nav">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="nav-icon">{tab.icon}</span>
              <span className="nav-label">{tab.label}</span>
            </button>
          ))}
        </nav>
        <DataControls />
      </aside>
      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}

export default App;
