import React, { useState, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import Modal from '../components/common/Modal';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import * as XLSX from 'xlsx';
import './Page.css';
import './CreditTracker.css';

// ── Categories ─────────────────────────────────────────────────────────────────
const CATEGORIES = [
  'מזון וסופרמרקט',
  'מסעדות ואוכל בחוץ',
  'תחבורה ודלק',
  'בריאות ורוקחות',
  'ביגוד והנעלה',
  'בית וריהוט',
  'בידור ופנאי',
  'חינוך וספרים',
  'נסיעות ותיירות',
  'תקשורת ואינטרנט',
  'ביטוחים',
  'מנויים ושירותים',
  'קניות אונליין',
  'שונות',
];

const CATEGORY_COLORS = [
  '#4361ee', '#f7932a', '#3ecf8e', '#f7ae3a', '#e94560', '#a259ff',
  '#b5b5b5', '#06d6a0', '#8ecae6', '#4895ef', '#fb8500', '#2d6a4f',
  '#d62828', '#999',
];

// ── Classification rules (keyword → category) ─────────────────────────────────
const RULES = [
  // Food & supermarkets
  { keywords: ['שופרסל', 'רמי לוי', 'מגה', 'ויקטורי', 'יינות ביתן', 'מחסני השוק', 'אושר עד', 'סופרמרקט', 'קו-אופ', 'AM:PM', 'freshmarket', 'fresh market'], category: 'מזון וסופרמרקט' },
  // Restaurants & food out
  { keywords: ['מקדונלד', 'קפה', 'פיצה', 'בורגר', 'שווארמה', 'פלאפל', 'מסעדה', 'מסעדות', 'הסושי', 'wolt', 'ten bis', 'tenbis', 'mishloha', 'משלוחה', 'ארומה', 'עוגיות', 'בית קפה', 'גוטה', 'cafe', 'resto'], category: 'מסעדות ואוכל בחוץ' },
  // Transport & fuel
  { keywords: ['סונול', 'פז', 'דלק', 'אלון', 'ten', 'גז', 'טסט', 'רישוי', 'רכבת', 'אגד', 'דן', 'מטרו', 'מוניות', 'גט', 'uber', 'bolt', 'parking', 'חניה', 'כביש 6', 'נתיבי איילון'], category: 'תחבורה ודלק' },
  // Health
  { keywords: ['בית מרקחת', 'סופר-פארם', 'superpharm', 'נאוטיליוס', 'קופת חולים', 'מכבי', 'לאומית', 'クリニック', 'קליניקה', 'רופא', 'דנטל', 'שיניים', 'ביטוח בריאות', 'תרופות'], category: 'בריאות ורוקחות' },
  // Clothing
  { keywords: ['זארה', 'H&M', 'MANGO', 'PULL', 'FOX', 'קסטרו', 'סטינה', 'בגדים', 'הנעלה', 'נעליים', 'adidas', 'nike', 'new balance', 'GANT', 'tommy'], category: 'ביגוד והנעלה' },
  // Home & furniture
  { keywords: ['IKEA', 'איקאה', 'home center', 'כהן עם', 'ACE', 'אייס', 'שופ אנד שופ', 'רהיטים', 'ריהוט', 'חשמל', 'מגה or', 'שקם', 'כהן'], category: 'בית וריהוט' },
  // Entertainment
  { keywords: ['סינמה', 'קולנוע', 'yes', 'netflix', 'spotify', 'disney', 'apple tv', 'steam', 'playstation', 'xbox', 'בידור', 'מופע', 'תאטרון', 'כרטיס'], category: 'בידור ופנאי' },
  // Education
  { keywords: ['ספר', 'אוניברסיטה', 'מכללה', 'קורס', 'חוג', 'לימוד', 'בית ספר', 'פדגוגי', 'amazon kindle'], category: 'חינוך וספרים' },
  // Travel
  { keywords: ['אל על', 'ראיין', 'wizz', 'booking', 'airbnb', 'מלון', 'טיסה', 'נסיעה', 'תיירות', 'agoda', 'expedia', 'אטרקציה'], category: 'נסיעות ותיירות' },
  // Communication
  { keywords: ['סלקום', 'פרטנר', 'הוט', 'bezeq', 'בזק', '012', '013', 'גולן', 'רמי לוי תקשורת', 'internet', 'אינטרנט', 'טלפון', 'נייד'], category: 'תקשורת ואינטרנט' },
  // Insurance
  { keywords: ['ביטוח', 'איילון', 'מגדל', 'הפניקס', 'הראל', 'כלל ביטוח', 'מנורה', 'ביטוחים', 'insurance'], category: 'ביטוחים' },
  // Subscriptions
  { keywords: ['מנוי', 'subscription', 'חידוש', 'google', 'microsoft', 'apple', 'icloud', 'dropbox', 'zoom', 'slack', 'adobe', 'canva', 'wix', 'godaddy'], category: 'מנויים ושירותים' },
  // Online shopping
  { keywords: ['amazon', 'aliexpress', 'ebay', 'shein', 'ASOS', 'paypal', 'אמזון', 'עלי אקספרס', 'אי ביי', 'online'], category: 'קניות אונליין' },
];

function autoClassify(description) {
  const lower = description.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some(kw => lower.includes(kw.toLowerCase()))) {
      return rule.category;
    }
  }
  return null;
}

// ── Excel parsing ──────────────────────────────────────────────────────────────
function parseIsraeliDate(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    // Excel serial date
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return d.toISOString().slice(0, 10);
  }
  const str = String(val).trim();
  // DD/MM/YYYY
  const match = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (match) {
    const [, d, m, y] = match;
    const year = y.length === 2 ? '20' + y : y;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return str;
}

function parseAmount(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return Math.abs(val);
  const cleaned = String(val).replace(/[₪,\s]/g, '').replace('-', '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : Math.abs(num);
}

function detectColumns(header) {
  const h = header.map(c => String(c || '').trim());
  const find = (...terms) => h.findIndex(c => terms.some(t => c.includes(t)));
  return {
    dateCol:   find('תאריך'),
    descCol:   find('שם בית עסק', 'תיאור', 'שם עסק', 'עסק', 'פירוט', 'שם'),
    amountCol: find('סכום חיוב', 'סכום', 'חיוב', 'amount'),
  };
}

function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        // Find header row — look for a row that has date + desc + amount columns
        let headerIdx = -1;
        let cols = null;
        for (let i = 0; i < Math.min(20, allRows.length); i++) {
          const c = detectColumns(allRows[i]);
          if (c.dateCol >= 0 && c.descCol >= 0 && c.amountCol >= 0) {
            headerIdx = i;
            cols = c;
            break;
          }
        }
        if (headerIdx < 0) {
          reject(new Error('לא ניתן לזהות עמודות תאריך, תיאור וסכום בקובץ'));
          return;
        }

        const rows = allRows.slice(headerIdx + 1);
        const transactions = rows
          .filter(r => r[cols.descCol] && r[cols.amountCol] !== '')
          .map((r, i) => {
            const amount = parseAmount(r[cols.amountCol]);
            if (!amount || amount <= 0) return null;
            const rawDate = parseIsraeliDate(r[cols.dateCol]);
            const description = String(r[cols.descCol]).trim();
            const category = autoClassify(description);
            return {
              id: Date.now() + i + Math.random(),
              date: rawDate || '',
              description,
              amount,
              category,
              manual: false,
            };
          })
          .filter(Boolean);

        resolve(transactions);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

// ── Helper fns ─────────────────────────────────────────────────────────────────
function fmt(n) { return Math.round(Number(n)).toLocaleString('he-IL'); }

function getCategoryColor(cat) {
  const idx = CATEGORIES.indexOf(cat);
  return idx >= 0 ? CATEGORY_COLORS[idx] : '#b5b5b5';
}

function getMonth(dateStr) {
  if (!dateStr || dateStr.length < 7) return null;
  return dateStr.slice(0, 7); // YYYY-MM
}

function fmtMonth(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  const names = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  return `${names[parseInt(m, 10) - 1]} ${y}`;
}

// ── CategorySelect ─────────────────────────────────────────────────────────────
function CategorySelect({ value, onChange }) {
  return (
    <select
      className="cat-select"
      value={value || ''}
      onChange={e => onChange(e.target.value || null)}
    >
      <option value="">— לא מסווג —</option>
      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}

// ── Import modal ───────────────────────────────────────────────────────────────
function ImportModal({ onImport, onClose }) {
  const [cardName, setCardName] = useState('');
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('classified');
  const fileRef = useRef();

  const handleFile = async e => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setLoading(true); setError('');
    try {
      const txns = await parseExcelFile(f);
      setParsed(txns);
    } catch (err) {
      setError(err.message || 'שגיאה בקריאת הקובץ');
    } finally {
      setLoading(false);
    }
  };

  const updateCategory = (id, cat) => {
    setParsed(prev => prev.map(t => t.id === id ? { ...t, category: cat, manual: true } : t));
  };

  const classified = parsed ? parsed.filter(t => t.category) : [];
  const unclassified = parsed ? parsed.filter(t => !t.category) : [];

  const handleConfirm = () => {
    if (!parsed) return;
    const tagged = parsed.map(t => ({ ...t, cardName: cardName || 'כרטיס אשראי' }));
    onImport(tagged);
  };

  return (
    <Modal title="ייבוא פעולות אשראי" onClose={onClose}>
      <div className="credit-import">
        <div className="credit-import-field">
          <label>שם הכרטיס</label>
          <input
            className="credit-card-name-input"
            value={cardName}
            onChange={e => setCardName(e.target.value)}
            placeholder="ויזה הפועלים, מסטרקארד לאומי..."
          />
        </div>

        <div className="credit-import-field">
          <label>קובץ אקסל</label>
          <button className="btn btn-secondary" onClick={() => fileRef.current.click()}>
            📂 בחר קובץ
          </button>
          {file && <span className="file-name">{file.name}</span>}
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} style={{ display: 'none' }} />
        </div>

        {loading && <div className="credit-loading">מנתח קובץ...</div>}
        {error && <div className="credit-error">{error}</div>}

        {parsed && (
          <>
            <div className="credit-tabs">
              <button
                className={`credit-tab ${activeTab === 'classified' ? 'active' : ''}`}
                onClick={() => setActiveTab('classified')}
              >
                מסווגים ({classified.length})
              </button>
              <button
                className={`credit-tab ${activeTab === 'unclassified' ? 'active' : ''}`}
                onClick={() => setActiveTab('unclassified')}
              >
                לא מסווגים ({unclassified.length})
                {unclassified.length > 0 && <span className="tab-badge">{unclassified.length}</span>}
              </button>
            </div>

            <div className="credit-preview-table-wrap">
              <table className="data-table credit-preview-table">
                <thead>
                  <tr><th>תאריך</th><th>תיאור</th><th>סכום</th><th>קטגוריה</th></tr>
                </thead>
                <tbody>
                  {(activeTab === 'classified' ? classified : unclassified).map(t => (
                    <tr key={t.id}>
                      <td className="credit-date">{t.date}</td>
                      <td className="credit-desc">{t.description}</td>
                      <td className="num">₪{fmt(t.amount)}</td>
                      <td>
                        <CategorySelect value={t.category} onChange={cat => updateCategory(t.id, cat)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="credit-import-footer">
              <span className="credit-import-summary">
                {parsed.length} פעולות · ₪{fmt(parsed.reduce((s, t) => s + t.amount, 0))} סה"כ
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary" onClick={onClose}>ביטול</button>
                <button className="btn btn-primary" onClick={handleConfirm} disabled={!parsed.length}>
                  ייבא {parsed.length} פעולות
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ── Main CreditTracker ─────────────────────────────────────────────────────────
export default function CreditTracker() {
  const { state, dispatch } = useApp();
  const transactions = useMemo(() => state.creditTransactions || [], [state.creditTransactions]);

  const [showImport, setShowImport] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterCard, setFilterCard] = useState('');

  const handleImport = txns => {
    dispatch({ type: 'ADD_CREDIT_TRANSACTIONS', payload: txns });
    setShowImport(false);
  };

  const handleDelete = id => {
    if (window.confirm('למחוק פעולה זו?')) {
      dispatch({ type: 'DELETE_CREDIT_TRANSACTION', payload: id });
    }
  };

  const handleCategoryChange = (id, category) => {
    const txn = transactions.find(t => t.id === id);
    if (txn) dispatch({ type: 'UPDATE_CREDIT_TRANSACTION', payload: { ...txn, category, manual: true } });
  };

  // Derived data
  const allMonths = useMemo(() => {
    const months = [...new Set(transactions.map(t => getMonth(t.date)).filter(Boolean))].sort();
    return months;
  }, [transactions]);

  const allCards = useMemo(() => {
    return [...new Set(transactions.map(t => t.cardName).filter(Boolean))].sort();
  }, [transactions]);

  const filtered = useMemo(() => {
    return transactions.filter(t =>
      (!filterCategory || t.category === filterCategory) &&
      (!filterMonth   || getMonth(t.date) === filterMonth) &&
      (!filterCard    || t.cardName === filterCard)
    );
  }, [transactions, filterCategory, filterMonth, filterCard]);

  const totalAmount = filtered.reduce((s, t) => s + t.amount, 0);
  const unclassifiedCount = transactions.filter(t => !t.category).length;

  // Monthly bar chart data
  const monthlyData = useMemo(() => {
    const map = {};
    transactions.forEach(t => {
      const m = getMonth(t.date);
      if (!m) return;
      if (!map[m]) map[m] = { month: m, label: fmtMonth(m), total: 0 };
      map[m].total += t.amount;
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
  }, [transactions]);

  // Category pie data (filtered by month/card if active)
  const relevantForPie = useMemo(() => {
    return transactions.filter(t =>
      (!filterMonth || getMonth(t.date) === filterMonth) &&
      (!filterCard  || t.cardName === filterCard) &&
      t.category
    );
  }, [transactions, filterMonth, filterCard]);

  const categoryPieData = useMemo(() => {
    const map = {};
    relevantForPie.forEach(t => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value, color: getCategoryColor(name) }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [relevantForPie]);

  const pieTotal = categoryPieData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">הוצאות אשראי</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {unclassifiedCount > 0 && (
            <span className="unclassified-badge">{unclassifiedCount} לא מסווגים</span>
          )}
          <button className="btn btn-primary" onClick={() => setShowImport(true)}>
            📥 ייבוא אקסל
          </button>
        </div>
      </div>

      {transactions.length === 0 && (
        <div className="empty-state">
          <p>אין פעולות אשראי עדיין</p>
          <p style={{ fontSize: '0.88rem', color: '#aaa' }}>ייבא קובץ אקסל מהבנק או חברת האשראי</p>
          <button className="btn btn-primary" onClick={() => setShowImport(true)}>ייבוא ראשון</button>
        </div>
      )}

      {transactions.length > 0 && (
        <>
          {/* KPI row */}
          <div className="credit-kpi-row">
            <div className="credit-kpi-card">
              <div className="credit-kpi-label">סה"כ חיובים</div>
              <div className="credit-kpi-value">₪{fmt(transactions.reduce((s, t) => s + t.amount, 0))}</div>
              <div className="credit-kpi-sub">{transactions.length} פעולות</div>
            </div>
            {allMonths.length > 0 && (
              <div className="credit-kpi-card">
                <div className="credit-kpi-label">ממוצע חודשי</div>
                <div className="credit-kpi-value">
                  ₪{fmt(transactions.reduce((s, t) => s + t.amount, 0) / allMonths.length)}
                </div>
                <div className="credit-kpi-sub">{allMonths.length} חודשים</div>
              </div>
            )}
            <div className="credit-kpi-card">
              <div className="credit-kpi-label">כרטיסים</div>
              <div className="credit-kpi-value">{allCards.length || '—'}</div>
              <div className="credit-kpi-sub">{allCards.join(', ') || 'לא צוין'}</div>
            </div>
            {unclassifiedCount > 0 && (
              <div className="credit-kpi-card warn">
                <div className="credit-kpi-label">לסיווג</div>
                <div className="credit-kpi-value">{unclassifiedCount}</div>
                <div className="credit-kpi-sub">פעולות ללא קטגוריה</div>
              </div>
            )}
          </div>

          {/* Monthly bar chart */}
          {monthlyData.length > 1 && (
            <div className="card credit-chart-card">
              <div className="credit-chart-title">הוצאות לפי חודש</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => `₪${fmt(v)}`} tick={{ fontSize: 11 }} width={80} />
                  <Tooltip
                    formatter={v => [`₪${fmt(v)}`, 'הוצאות']}
                    cursor={{ fill: '#f0f4ff' }}
                  />
                  <Bar
                    dataKey="total"
                    name="הוצאות"
                    fill="#4361ee"
                    radius={[4, 4, 0, 0]}
                    onClick={d => setFilterMonth(prev => prev === d.month ? '' : d.month)}
                  />
                </BarChart>
              </ResponsiveContainer>
              {filterMonth && (
                <div className="credit-active-filter">
                  מציג: {fmtMonth(filterMonth)}
                  <button onClick={() => setFilterMonth('')} className="filter-clear">✕ נקה</button>
                </div>
              )}
            </div>
          )}

          {/* Category pie + legend */}
          {categoryPieData.length > 0 && (
            <div className="card credit-chart-card">
              <div className="credit-chart-title">
                פיזור לפי קטגוריה
                {filterCategory && <span style={{ marginRight: 8, fontSize: '0.82rem', color: '#4361ee' }}>· מסונן: {filterCategory}</span>}
              </div>
              <div className="dash-chart-layout-sm">
                <ResponsiveContainer width={220} height={220}>
                  <PieChart>
                    <Pie
                      data={categoryPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%" cy="50%"
                      innerRadius={50} outerRadius={95}
                      onClick={d => setFilterCategory(prev => prev === d.name ? '' : d.name)}
                      style={{ cursor: 'pointer' }}
                    >
                      {categoryPieData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.color}
                          opacity={filterCategory && filterCategory !== entry.name ? 0.35 : 1}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={v => `₪${fmt(v)}`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="dash-legend">
                  {categoryPieData.map((entry, i) => (
                    <div
                      key={i}
                      className={`legend-row credit-legend-row ${filterCategory === entry.name ? 'active' : ''}`}
                      onClick={() => setFilterCategory(prev => prev === entry.name ? '' : entry.name)}
                    >
                      <span className="legend-dot" style={{ background: entry.color }} />
                      <span className="legend-name">{entry.name}</span>
                      <span className="legend-pct">{pieTotal > 0 ? ((entry.value / pieTotal) * 100).toFixed(1) : 0}%</span>
                      <span className="legend-amount">₪{fmt(entry.value)}</span>
                    </div>
                  ))}
                  <div className="legend-total"><span>סה"כ</span><span>₪{fmt(pieTotal)}</span></div>
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="filter-bar">
            {allMonths.length > 1 && (
              <select className="filter-select" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
                <option value="">כל החודשים</option>
                {allMonths.map(m => <option key={m} value={m}>{fmtMonth(m)}</option>)}
              </select>
            )}
            {allCards.length > 1 && (
              <select className="filter-select" value={filterCard} onChange={e => setFilterCard(e.target.value)}>
                <option value="">כל הכרטיסים</option>
                {allCards.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <select className="filter-select" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="">כל הקטגוריות</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {(filterMonth || filterCard || filterCategory) && (
              <button className="filter-clear" onClick={() => { setFilterMonth(''); setFilterCard(''); setFilterCategory(''); }}>
                ✕ נקה הכל
              </button>
            )}
          </div>

          {/* Transactions table */}
          <div className="card credit-table-card desktop-only">
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>תאריך</th>
                    <th>תיאור</th>
                    <th>סכום</th>
                    <th>קטגוריה</th>
                    <th>כרטיס</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: '#aaa', padding: 24 }}>אין פעולות להצגה</td></tr>
                  ) : filtered.sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(t => (
                    <tr key={t.id} className={!t.category ? 'unclassified-row' : ''}>
                      <td className="credit-date">{t.date}</td>
                      <td>{t.description}</td>
                      <td className="num">₪{fmt(t.amount)}</td>
                      <td>
                        <CategorySelect value={t.category} onChange={cat => handleCategoryChange(t.id, cat)} />
                      </td>
                      <td>{t.cardName || '—'}</td>
                      <td className="actions-cell">
                        <button className="icon-btn" onClick={() => handleDelete(t.id)}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {filtered.length > 0 && (
                  <tfoot>
                    <tr className="total-row">
                      <td colSpan={2}><strong>סה"כ{(filterMonth || filterCard || filterCategory) ? ' (מסונן)' : ''}</strong></td>
                      <td className="num"><strong>₪{fmt(totalAmount)}</strong></td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="mobile-only">
            {filtered.sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(t => (
              <div key={t.id} className={`mcard ${!t.category ? 'unclassified-mcard' : ''}`}>
                <div className="mcard-header">
                  <span className="mcard-name">{t.description}</span>
                  <span className="mcard-value">₪{fmt(t.amount)}</span>
                  <button className="icon-btn" onClick={() => handleDelete(t.id)}>🗑️</button>
                </div>
                <div className="mcard-row">
                  <div className="mcard-stat">
                    <span className="mcard-label">תאריך</span>
                    <span className="mcard-value" style={{ fontSize: '0.85rem' }}>{t.date}</span>
                  </div>
                  <div className="mcard-stat">
                    <CategorySelect value={t.category} onChange={cat => handleCategoryChange(t.id, cat)} />
                  </div>
                </div>
              </div>
            ))}
            {filtered.length > 0 && (
              <div className="mcard-total">
                <span>סה"כ</span>
                <span>₪{fmt(totalAmount)}</span>
              </div>
            )}
          </div>
        </>
      )}

      {showImport && (
        <ImportModal onImport={handleImport} onClose={() => setShowImport(false)} />
      )}
    </div>
  );
}
