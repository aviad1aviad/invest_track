import React, { useState } from 'react';
import { AppProvider } from './context/AppContext';
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

function App() {
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
    <AppProvider>
      <div className="app" dir="rtl">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <span className="brand-icon">💼</span>
            <span className="brand-name">InvestTrack</span>
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
        </aside>
        <main className="main-content">
          {renderPage()}
        </main>
      </div>
    </AppProvider>
  );
}

export default App;
