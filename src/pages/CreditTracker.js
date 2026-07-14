import React, { useState, useRef, useMemo, useEffect } from 'react';
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

// Keyword-only fallback (used for re-classification without branch context)
function autoClassifyKeyword(description) {
  const lower = description.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some(kw => lower.includes(kw.toLowerCase()))) {
      return rule.category;
    }
  }
  return null;
}

// Full classify: branch map takes priority, then keywords
function autoClassify(description, branch, branchMap) {
  if (branch && branchMap && branchMap[branch]) return branchMap[branch];
  return autoClassifyKeyword(description);
}

// ── Excel parsing ──────────────────────────────────────────────────────────────
function parseIsraeliDate(val, swapDayMonth = false) {
  if (!val) return null;
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return d.toISOString().slice(0, 10);
  }
  const str = String(val).trim();
  const match = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (match) {
    const [, a, b, y] = match;
    let [d, m] = swapDayMonth ? [b, a] : [a, b];
    // Auto-fix: if parsed month is impossible (>12), the file uses MM/DD — swap automatically
    if (parseInt(m, 10) > 12) { [d, m] = [m, d]; }
    const year = y.length === 2 ? '20' + y : y;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return str;
}

// Fix already-stored dates where day/month were swapped (e.g. "2026-20-05" → "2026-05-20")
function normalizeDate(dateStr) {
  if (!dateStr || dateStr.length < 10) return dateStr || '';
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m && parseInt(m[2], 10) > 12 && parseInt(m[3], 10) <= 12) {
    return `${m[1]}-${m[3]}-${m[2]}`;
  }
  return dateStr;
}

function parseAmount(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return Math.abs(val);
  const cleaned = String(val).replace(/[₪,\s]/g, '').replace('-', '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : Math.abs(num);
}

function detectColumns(header) {
  // Normalize \r\n within cells (common in Israeli bank exports like Diners/Mastercard)
  const h = header.map(c => String(c || '').replace(/[\r\n]+/g, ' ').trim());
  const find = (...terms) => h.findIndex(c => terms.some(t => c.includes(t)));
  // Credit card: שם בית עסק / Bank: סוג תנועה
  const descCol = find('שם בית עסק', 'שם עסק', 'סוג תנועה', 'פרטי עסקה', 'פירוט', 'תיאור', 'עסק');
  const billingDateCol = find('תאריך חיוב', 'תאריך קרדיט', 'תאריך חיוב בפועל', 'חיוב בתאריך');
  const dateCol = find('תאריך עסקה', 'תאריך');
  // Credit: סכום חיוב / Bank debit: חובה / Bank credit: זכות
  const amountCol = find('סכום חיוב', 'סכום עסקה', 'חובה', 'סכום', 'amount');
  return {
    dateCol,
    billingDateCol,
    descCol,
    amountCol,
    branchCol: find('ענף', 'תחום', 'קטגוריה', 'סוג עסקה'),
  };
}

// Load raw rows + auto-detect columns — does NOT fully parse yet
function loadRawFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        // Try all sheets; pick the one where we can detect a valid header (date+amount)
        let allRows = [];
        let chosenSheet = null;
        for (const name of wb.SheetNames) {
          const sheet = wb.Sheets[name];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
          const hasHeader = rows.slice(0, 25).some(r => {
            const c = detectColumns(r);
            return c.dateCol >= 0 && c.amountCol >= 0;
          });
          if (hasHeader || rows.length > allRows.length) { allRows = rows; chosenSheet = sheet; }
          if (hasHeader) break;
        }

        let headerIdx = -1;
        let detectedCols = null;
        for (let i = 0; i < Math.min(25, allRows.length); i++) {
          const c = detectColumns(allRows[i]);
          if (c.dateCol >= 0 && c.amountCol >= 0) {
            headerIdx = i;
            detectedCols = c;
            break;
          }
        }
        // Fallback: use first non-empty row as header even if we can't detect desc
        if (headerIdx < 0) {
          for (let i = 0; i < Math.min(25, allRows.length); i++) {
            if (allRows[i].some(c => c !== '')) { headerIdx = i; break; }
          }
          detectedCols = { dateCol: -1, billingDateCol: -1, descCol: -1, amountCol: -1, branchCol: -1 };
        }

        // Normalize \r\n in header labels for display
        const headers = (allRows[headerIdx] || []).map((c, i) => ({
          label: String(c || `עמודה ${i + 1}`).replace(/[\r\n]+/g, ' ').trim(),
          idx: i,
        }));

        // Extract global billing date from pre-header rows (e.g. "עסקאות לחיוב ב-10/06/2026")
        let globalBillingDate = '';
        const scanLimit = headerIdx >= 0 ? headerIdx : Math.min(10, allRows.length);
        for (let i = 0; i < scanLimit; i++) {
          const text = allRows[i].map(c => String(c || '')).join(' ');
          const m = text.match(/לחיוב ב-(\d{1,2}\/\d{1,2}\/\d{4})/);
          if (m) { globalBillingDate = parseIsraeliDate(m[1]) || ''; break; }
        }

        // Fix Israeli bank numeric date cells: format code "m/d/yy" in Hebrew locale means D/M/YY.
        // The bank displays "10/6/26" = June 10, but XLSX interprets the serial as October 6.
        // Solution: use SSF to get the formatted string, then parseIsraeliDate treats it as DD/MM/YY.
        if (chosenSheet && detectedCols) {
          const dateCols = [detectedCols.dateCol, detectedCols.billingDateCol].filter(c => c >= 0);
          for (let i = headerIdx + 1; i < allRows.length; i++) {
            for (const col of dateCols) {
              const cell = chosenSheet[XLSX.utils.encode_cell({ r: i, c: col })];
              if (cell && cell.t === 'n' && cell.z === 'm/d/yy') {
                allRows[i][col] = XLSX.SSF.format(cell.z, cell.v);
              }
            }
          }
        }

        const previewRows = allRows.slice(headerIdx + 1, headerIdx + 6);

        resolve({ headers, previewRows, allRows, headerIdx, detectedCols, globalBillingDate });
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

function parseWithCols(allRows, headerIdx, cols, globalBillingDate = '', branchMap = {}) {
  const rows = allRows.slice(headerIdx + 1);
  return rows
    .filter(r => r[cols.descCol] !== '' && r[cols.descCol] !== undefined && r[cols.amountCol] !== '')
    .map((r, i) => {
      const amount = parseAmount(r[cols.amountCol]);
      if (!amount || amount <= 0) return null;
      const description = String(r[cols.descCol]).trim();
      if (!description) return null;
      const branch = cols.branchCol >= 0 ? String(r[cols.branchCol] || '').trim() : '';
      const txDate = parseIsraeliDate(r[cols.dateCol]) || '';
      // Use per-row billing date column if mapped, otherwise fall back to global billing date from file header
      const billingDate = cols.billingDateCol >= 0
        ? (parseIsraeliDate(r[cols.billingDateCol]) || globalBillingDate)
        : globalBillingDate;
      return {
        id: Date.now() + i + Math.random(),
        date: txDate,
        billingDate,
        description,
        amount,
        branch,
        category: autoClassify(description, branch, branchMap),
        manual: false,
      };
    })
    .filter(Boolean);
}

// ── Helper fns ─────────────────────────────────────────────────────────────────
function fmt(n) { return Math.round(Number(n)).toLocaleString('he-IL'); }

function getCategoryColor(cat, activeCategories) {
  const list = activeCategories && activeCategories.length > 0 ? activeCategories : CATEGORIES;
  const idx = list.indexOf(cat);
  return idx >= 0 ? CATEGORY_COLORS[idx % CATEGORY_COLORS.length] : '#b5b5b5';
}

function getMonth(dateStr) {
  const fixed = normalizeDate(dateStr);
  if (!fixed || fixed.length < 7) return null;
  return fixed.slice(0, 7); // YYYY-MM
}

function fmtMonth(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  const names = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  return `${names[parseInt(m, 10) - 1]} ${y}`;
}

// ── CategorySelect ─────────────────────────────────────────────────────────────
function CategorySelect({ value, onChange, categories }) {
  const cats = categories && categories.length > 0 ? categories : CATEGORIES;
  return (
    <select
      className="cat-select"
      value={value || ''}
      onChange={e => onChange(e.target.value || null)}
    >
      <option value="">— לא מסווג —</option>
      {cats.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}

// ── Multi-category filter dropdown ────────────────────────────────────────────
function MultiCategoryFilter({ categories, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = cat => onChange(
    selected.includes(cat) ? selected.filter(c => c !== cat) : [...selected, cat]
  );

  const label = selected.length === 0 ? 'כל הקטגוריות' : `${selected.length} קטגוריות ▾`;

  return (
    <div className="multi-cat-filter" ref={ref}>
      <button
        className={`filter-select multi-cat-trigger ${selected.length > 0 ? 'active' : ''}`}
        onClick={() => setOpen(p => !p)}
      >
        {label}
      </button>
      {open && (
        <div className="multi-cat-dropdown">
          {categories.map(cat => (
            <label key={cat} className="multi-cat-option">
              <input type="checkbox" checked={selected.includes(cat)} onChange={() => toggle(cat)} />
              <span>{cat}</span>
            </label>
          ))}
          {selected.length > 0 && (
            <button className="filter-clear multi-cat-clear" onClick={() => { onChange([]); setOpen(false); }}>
              ✕ נקה בחירה
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Category Settings modal ────────────────────────────────────────────────────
function CategorySettingsModal({ onClose, onSave, initialCategories, initialBranchMap, knownBranches }) {
  const [categories, setCategories] = useState(initialCategories);
  const [branchMap, setBranchMap] = useState({ ...initialBranchMap });
  const [newCatName, setNewCatName] = useState('');
  const [editingCat, setEditingCat] = useState(null); // { original, value }
  const [renames, setRenames] = useState({});          // { oldName: newName }

  const addCategory = () => {
    const name = newCatName.trim();
    if (!name || categories.includes(name)) return;
    setCategories(prev => [...prev, name]);
    setNewCatName('');
  };

  const removeCategory = cat => {
    setCategories(prev => prev.filter(c => c !== cat));
    setBranchMap(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { if (next[k] === cat) delete next[k]; });
      return next;
    });
  };

  const startEdit = cat => setEditingCat({ original: cat, value: cat });

  const confirmEdit = () => {
    if (!editingCat) return;
    const newName = editingCat.value.trim();
    if (!newName || (newName !== editingCat.original && categories.includes(newName))) {
      setEditingCat(null); return;
    }
    if (newName === editingCat.original) { setEditingCat(null); return; }
    const old = editingCat.original;
    setCategories(prev => prev.map(c => c === old ? newName : c));
    setBranchMap(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { if (next[k] === old) next[k] = newName; });
      return next;
    });
    setRenames(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { if (next[k] === old) next[k] = newName; });
      next[old] = newName;
      return next;
    });
    setEditingCat(null);
  };

  const setMapping = (branch, cat) => {
    setBranchMap(prev => {
      const next = { ...prev };
      if (!cat) delete next[branch]; else next[branch] = cat;
      return next;
    });
  };

  return (
    <Modal title="ניהול קטגוריות" onClose={onClose}>
      <div className="credit-import" style={{ minWidth: 400 }}>

        {/* Categories list */}
        <div>
          <div className="col-map-title" style={{ marginBottom: 10 }}>הקטגוריות שלי</div>
          <div className="cat-chips">
            {categories.map(cat => (
              editingCat && editingCat.original === cat ? (
                <span key={cat} className="cat-chip cat-chip-editing">
                  <input
                    className="cat-edit-input"
                    value={editingCat.value}
                    autoFocus
                    onChange={e => setEditingCat(p => ({ ...p, value: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') confirmEdit(); if (e.key === 'Escape') setEditingCat(null); }}
                  />
                  <button className="cat-chip-confirm" onClick={confirmEdit} title="אשר">✓</button>
                  <button className="cat-chip-remove" onClick={() => setEditingCat(null)} title="בטל">✕</button>
                </span>
              ) : (
                <span key={cat} className="cat-chip">
                  {cat}
                  <button className="cat-chip-edit" onClick={() => startEdit(cat)} title="שנה שם">✏️</button>
                  <button className="cat-chip-remove" onClick={() => removeCategory(cat)} title="מחק">×</button>
                </span>
              )
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input
              className="credit-card-name-input"
              style={{ flex: 1 }}
              placeholder="שם קטגוריה חדשה..."
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCategory()}
            />
            <button className="btn btn-secondary" onClick={addCategory}>+ הוסף</button>
          </div>
        </div>

        {/* Branch → category mapping */}
        {knownBranches.length > 0 && (
          <div>
            <div className="col-map-title" style={{ marginBottom: 10 }}>מיפוי ענף ← קטגוריה</div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ fontSize: '0.9rem' }}>
                <thead>
                  <tr><th>ענף (מהקובץ)</th><th>קטגוריה</th></tr>
                </thead>
                <tbody>
                  {knownBranches.map(branch => (
                    <tr key={branch}>
                      <td>{branch}</td>
                      <td>
                        <select
                          className="filter-select"
                          value={branchMap[branch] || ''}
                          onChange={e => setMapping(branch, e.target.value)}
                        >
                          <option value="">— לא מסווג —</option>
                          {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="credit-import-footer">
          <span className="credit-import-summary">
            {Object.keys(branchMap).length} ענפים ממופים מתוך {knownBranches.length}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={onClose}>ביטול</button>
            <button className="btn btn-primary" onClick={() => onSave({ newCategories: categories, newBranchMap: branchMap, renames })}>
              שמור ויישם
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── Import modal ───────────────────────────────────────────────────────────────
function ImportModal({ onImport, onClose, branchMap, categories }) {
  const [sourceType, setSourceType] = useState('credit'); // 'credit' | 'bank'
  const [cardName, setCardName] = useState('');
  const [file, setFile] = useState(null);
  const [rawData, setRawData] = useState(null);   // { headers, previewRows, allRows, headerIdx, detectedCols }
  const [cols, setCols] = useState(null);          // { dateCol, descCol, amountCol }
  const [parsed, setParsed] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('classified');
  const [step, setStep] = useState('file');        // 'file' | 'map' | 'review'
  const fileRef = useRef();

  const handleFile = async e => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setLoading(true); setError(''); setRawData(null); setParsed(null); setCols(null);
    try {
      const raw = await loadRawFile(f);
      setRawData(raw);
      setCols(raw.detectedCols);
      setStep('map');
    } catch (err) {
      setError(err.message || 'שגיאה בקריאת הקובץ');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyCols = () => {
    if (cols.dateCol < 0 || cols.descCol < 0 || cols.amountCol < 0) {
      setError('יש לבחור עמודה לכל שדה (תאריך, תיאור, סכום)');
      return;
    }
    setError('');
    try {
      const txns = parseWithCols(rawData.allRows, rawData.headerIdx, cols, rawData.globalBillingDate || '', branchMap || {});
      if (txns.length === 0) { setError('לא נמצאו שורות עם נתונים תקינים'); return; }
      setParsed(txns);
      setStep('review');
    } catch (err) {
      setError(err.message || 'שגיאה בניתוח הנתונים');
    }
  };

  const updateCategory = (id, cat) => {
    setParsed(prev => prev.map(t => t.id === id ? { ...t, category: cat, manual: true } : t));
  };

  const classified = parsed ? parsed.filter(t => t.category) : [];
  const unclassified = parsed ? parsed.filter(t => !t.category) : [];

  const handleConfirm = () => {
    if (!parsed) return;
    const defaultName = sourceType === 'bank' ? 'חשבון בנק' : 'כרטיס אשראי';
    const tagged = parsed.map(t => ({ ...t, cardName: cardName || defaultName, sourceType }));
    onImport(tagged);
  };

  const ColSelect = ({ label, field }) => (
    <div className="col-map-row">
      <span className="col-map-label">{label}</span>
      <select
        className="filter-select"
        value={cols[field] >= 0 ? cols[field] : ''}
        onChange={e => setCols(c => ({ ...c, [field]: e.target.value === '' ? -1 : Number(e.target.value) }))}
      >
        <option value="">— לא נבחר —</option>
        {(rawData?.headers || []).map(h => (
          <option key={h.idx} value={h.idx}>{h.label || `עמודה ${h.idx + 1}`}</option>
        ))}
      </select>
    </div>
  );

  return (
    <Modal title="ייבוא פעולות" onClose={onClose}>
      <div className="credit-import">

        {/* Source type toggle */}
        <div className="source-type-toggle">
          <button
            className={`source-type-btn ${sourceType === 'credit' ? 'active' : ''}`}
            onClick={() => setSourceType('credit')}
          >💳 כרטיס אשראי</button>
          <button
            className={`source-type-btn ${sourceType === 'bank' ? 'active' : ''}`}
            onClick={() => setSourceType('bank')}
          >🏦 חשבון בנק</button>
        </div>

        {/* Always-visible: source name + file picker */}
        <div className="credit-import-top">
          <div className="credit-import-field">
            <label>{sourceType === 'bank' ? 'שם החשבון' : 'שם הכרטיס'}</label>
            <input
              className="credit-card-name-input"
              value={cardName}
              onChange={e => setCardName(e.target.value)}
              placeholder={sourceType === 'bank' ? 'מזרחי עו"ש, הפועלים...' : 'ויזה הפועלים, כאל, מסטרקארד...'}
            />
          </div>
          <div className="credit-import-field">
            <label>קובץ אקסל</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn btn-secondary" onClick={() => fileRef.current.click()}>
                📂 בחר קובץ
              </button>
              {file && <span className="file-name">{file.name}</span>}
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} style={{ display: 'none' }} />
          </div>
        </div>

        {loading && <div className="credit-loading">קורא קובץ...</div>}
        {error && <div className="credit-error">{error}</div>}

        {/* Step: column mapping */}
        {step === 'map' && rawData && cols && (
          <>
            <div className="col-map-section">
              <div className="col-map-title">
                בחר איזו עמודה מכילה כל שדה
                {cols.dateCol >= 0 && cols.descCol >= 0 && cols.amountCol >= 0
                  ? <span className="col-map-ok"> ✓ זוהו אוטומטית</span>
                  : <span className="col-map-warn"> ← יש לבחור ידנית</span>}
              </div>
              <ColSelect label="תאריך עסקה" field="dateCol" />
              {rawData.globalBillingDate
                ? <div style={{ fontSize: '0.85rem', color: '#1a7a4a', fontWeight: 600, padding: '4px 0' }}>
                    📅 תאריך חיוב זוהה: {rawData.globalBillingDate} (יוחל על כל העסקאות)
                  </div>
                : <ColSelect label="תאריך חיוב (אופציונלי)" field="billingDateCol" />
              }
              <ColSelect label="שם / תיאור העסק" field="descCol" />
              <ColSelect label={sourceType === 'bank' ? 'עמודת חובה (הוצאות)' : 'סכום החיוב'} field="amountCol" />
              <ColSelect label="ענף / תחום (אופציונלי)" field="branchCol" />
            </div>

            {/* Preview of first rows with currently-selected columns highlighted */}
            <div className="col-map-preview-wrap">
              <div className="col-map-preview-title">תצוגה מקדימה (5 שורות ראשונות)</div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table col-map-preview-table">
                  <thead>
                    <tr>
                      {rawData.headers.map(h => (
                        <th key={h.idx} className={
                          h.idx === cols.dateCol ? 'col-hl-date' :
                          h.idx === cols.descCol ? 'col-hl-desc' :
                          h.idx === cols.amountCol ? 'col-hl-amount' : ''
                        }>
                          {h.idx === cols.dateCol ? '📅 ' : h.idx === cols.descCol ? '🏪 ' : h.idx === cols.amountCol ? '₪ ' : ''}
                          {h.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rawData.previewRows.map((row, ri) => (
                      <tr key={ri}>
                        {rawData.headers.map(h => (
                          <td key={h.idx} className={
                            h.idx === cols.dateCol ? 'col-hl-date' :
                            h.idx === cols.descCol ? 'col-hl-desc' :
                            h.idx === cols.amountCol ? 'col-hl-amount' : 'col-dim'
                          }>
                            {(h.idx === cols.dateCol || h.idx === cols.billingDateCol)
                              ? (parseIsraeliDate(row[h.idx]) || String(row[h.idx] ?? ''))
                              : String(row[h.idx] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="credit-import-footer">
              <span className="credit-import-summary">
                {rawData.allRows.length - rawData.headerIdx - 1} שורות בקובץ
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary" onClick={onClose}>ביטול</button>
                <button className="btn btn-primary" onClick={handleApplyCols}>
                  המשך →
                </button>
              </div>
            </div>
          </>
        )}

        {/* Step: classify & review */}
        {step === 'review' && parsed && (
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
                        <CategorySelect value={t.category} onChange={cat => updateCategory(t.id, cat)} categories={categories} />
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
                <button className="btn btn-secondary" onClick={() => setStep('map')}>← חזור</button>
                <button className="btn btn-primary" onClick={handleConfirm}>
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

  // Custom categories and branch mapping from state
  const categories = useMemo(
    () => (state.creditCategories && state.creditCategories.length > 0 ? state.creditCategories : CATEGORIES),
    [state.creditCategories]
  );
  const branchMap = useMemo(() => state.creditBranchMap || {}, [state.creditBranchMap]);

  const [showImport, setShowImport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [filterCategories, setFilterCategories] = useState([]); // string[]
  const [filterMonth, setFilterMonth] = useState('');
  const [filterCard, setFilterCard] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterUnclassified, setFilterUnclassified] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const filterInitialized = useRef(false);

  // Default to most recent month on first load
  useEffect(() => {
    if (!filterInitialized.current && allMonths.length > 0) {
      filterInitialized.current = true;
      setFilterMonth(allMonths[0]);
    }
  }, [allMonths]);

  const handleImport = txns => {
    dispatch({ type: 'ADD_CREDIT_TRANSACTIONS', payload: txns });
    setShowImport(false);
  };

  const handleDelete = id => {
    if (window.confirm('למחוק פעולה זו?')) {
      dispatch({ type: 'DELETE_CREDIT_TRANSACTION', payload: id });
      setSelectedIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(`למחוק ${selectedIds.size} פעולות מסומנות?`)) {
      selectedIds.forEach(id => dispatch({ type: 'DELETE_CREDIT_TRANSACTION', payload: id }));
      setSelectedIds(new Set());
    }
  };

  const handleCategoryChange = (id, category) => {
    const txn = transactions.find(t => t.id === id);
    if (txn) dispatch({ type: 'UPDATE_CREDIT_TRANSACTION', payload: { ...txn, category, manual: true } });
  };

  const handleSaveSettings = ({ newCategories, newBranchMap, renames = {} }) => {
    dispatch({ type: 'SET_CREDIT_CATEGORIES', payload: newCategories });
    const reclassified = transactions.map(t => {
      if (t.branch && newBranchMap[t.branch]) return { ...t, category: newBranchMap[t.branch] };
      if (t.category && renames[t.category]) return { ...t, category: renames[t.category] };
      if (!t.category) {
        const kw = autoClassifyKeyword(t.description);
        if (kw) return { ...t, category: kw };
      }
      return t;
    });
    dispatch({ type: 'APPLY_CREDIT_BRANCH_MAP', payload: { branchMap: newBranchMap, transactions: reclassified } });
    setShowSettings(false);
  };

  // Derived data — use billing date for month grouping
  const allMonths = useMemo(() => {
    const months = [...new Set(transactions.map(t => getMonth(t.billingDate || t.date)).filter(Boolean))].sort().reverse();
    return months;
  }, [transactions]);

  const allCards = useMemo(() => {
    return [...new Set(transactions.map(t => t.cardName).filter(Boolean))].sort();
  }, [transactions]);

  const filtered = useMemo(() => {
    return transactions.filter(t =>
      (!filterCategories.length || filterCategories.includes(t.category)) &&
      (!filterMonth             || getMonth(t.billingDate || t.date) === filterMonth) &&
      (!filterCard              || t.cardName === filterCard) &&
      (!filterSource            || (t.sourceType || 'credit') === filterSource) &&
      (!filterUnclassified      || !t.category)
    );
  }, [transactions, filterCategories, filterMonth, filterCard, filterSource, filterUnclassified]);

  const sortedFiltered = useMemo(
    () => [...filtered].sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [filtered]
  );

  const totalAmount = filtered.reduce((s, t) => s + t.amount, 0);
  const unclassifiedCount = transactions.filter(t => !t.category).length;

  const toggleSelect = id => setSelectedIds(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  const isAllSelected = sortedFiltered.length > 0 && sortedFiltered.every(t => selectedIds.has(t.id));
  const isIndeterminate = !isAllSelected && sortedFiltered.some(t => selectedIds.has(t.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(prev => { const s = new Set(prev); sortedFiltered.forEach(t => s.delete(t.id)); return s; });
    } else {
      setSelectedIds(prev => { const s = new Set(prev); sortedFiltered.forEach(t => s.add(t.id)); return s; });
    }
  };

  const selectedAmount = sortedFiltered.filter(t => selectedIds.has(t.id)).reduce((s, t) => s + t.amount, 0);

  // Monthly bar chart data (by billing date)
  const monthlyData = useMemo(() => {
    const map = {};
    transactions.forEach(t => {
      const m = getMonth(t.billingDate || t.date);
      if (!m) return;
      if (!map[m]) map[m] = { month: m, label: fmtMonth(m), total: 0 };
      map[m].total += t.amount;
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
  }, [transactions]);

  // Current / latest month total (ignores category filter, reflects card/source filter)
  const currentMonthTotal = useMemo(() => {
    const m = filterMonth || (allMonths.length > 0 ? allMonths[0] : '');
    if (!m) return 0;
    return transactions
      .filter(t => getMonth(t.billingDate || t.date) === m)
      .reduce((s, t) => s + t.amount, 0);
  }, [transactions, filterMonth, allMonths]);

  // All unique non-empty branch values (for settings modal)
  const knownBranches = useMemo(() => {
    return [...new Set(transactions.map(t => t.branch).filter(Boolean))].sort();
  }, [transactions]);

  // Category pie data — not filtered by category (shows all categories for month/card)
  const relevantForPie = useMemo(() => {
    return transactions.filter(t =>
      (!filterMonth  || getMonth(t.billingDate || t.date) === filterMonth) &&
      (!filterCard   || t.cardName === filterCard) &&
      (!filterSource || (t.sourceType || 'credit') === filterSource) &&
      t.category
    );
  }, [transactions, filterMonth, filterCard, filterSource]);

  const categoryPieData = useMemo(() => {
    const map = {};
    relevantForPie.forEach(t => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    const divisor = (!filterMonth && allMonths.length > 1) ? allMonths.length : 1;
    return Object.entries(map)
      .map(([name, value]) => ({ name, value: Math.round(value / divisor), color: getCategoryColor(name, categories) }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [relevantForPie, categories, filterMonth, allMonths]);

  const pieTotal = categoryPieData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">הוצאות אשראי</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {unclassifiedCount > 0 && (
            <span className="unclassified-badge">{unclassifiedCount} לא מסווגים</span>
          )}
          <button className="btn btn-secondary" onClick={() => setShowSettings(true)} title="ניהול קטגוריות">
            ⚙️ קטגוריות
          </button>
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
              <div className="credit-kpi-label">הוצאה חודשית</div>
              <div className="credit-kpi-value">₪{fmt(currentMonthTotal)}</div>
              <div className="credit-kpi-sub">{fmtMonth(filterMonth || allMonths[0]) || '—'}</div>
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
            </div>
          )}

          {/* Month tabs */}
          {allMonths.length > 0 && (
            <div className="credit-month-tabs">
              <button
                className={`credit-month-tab ${filterMonth === '' ? 'active' : ''}`}
                onClick={() => setFilterMonth('')}
              >
                כל החודשים
              </button>
              {allMonths.map(m => (
                <button
                  key={m}
                  className={`credit-month-tab ${filterMonth === m ? 'active' : ''}`}
                  onClick={() => setFilterMonth(m)}
                >
                  {fmtMonth(m)}
                </button>
              ))}
            </div>
          )}

          {/* Category pie + legend */}
          {categoryPieData.length > 0 && (
            <div className="card credit-chart-card">
              <div className="credit-chart-title">
                {!filterMonth && allMonths.length > 1 ? 'ממוצע חודשי לפי קטגוריה' : 'פיזור לפי קטגוריה'}
                {filterCategories.length > 0 && (
                  <span style={{ marginRight: 8, fontSize: '0.82rem', color: '#4361ee' }}>
                    · {filterCategories.length === 1 ? filterCategories[0] : `${filterCategories.length} קטגוריות · ₪${fmt(totalAmount)}`}
                  </span>
                )}
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
                      onClick={d => setFilterCategories(prev => prev.includes(d.name) ? prev.filter(c => c !== d.name) : [...prev, d.name])}
                      style={{ cursor: 'pointer' }}
                    >
                      {categoryPieData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.color}
                          opacity={filterCategories.length > 0 && !filterCategories.includes(entry.name) ? 0.35 : 1}
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
                      className={`legend-row credit-legend-row ${filterCategories.includes(entry.name) ? 'active' : ''}`}
                      onClick={() => setFilterCategories(prev => prev.includes(entry.name) ? prev.filter(c => c !== entry.name) : [...prev, entry.name])}
                    >
                      <span className="legend-dot" style={{ background: entry.color }} />
                      <span className="legend-name">{entry.name}</span>
                      <span className="legend-pct">{pieTotal > 0 ? ((entry.value / pieTotal) * 100).toFixed(1) : 0}%</span>
                      <span className="legend-amount">₪{fmt(entry.value)}</span>
                    </div>
                  ))}
                  <div className="legend-total"><span>{!filterMonth && allMonths.length > 1 ? 'ממוצע חודשי' : 'סה"כ'}</span><span>₪{fmt(pieTotal)}</span></div>
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="filter-bar">
            {allCards.length > 1 && (
              <select className="filter-select" value={filterCard} onChange={e => setFilterCard(e.target.value)}>
                <option value="">כל הכרטיסים/חשבונות</option>
                {allCards.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <select className="filter-select" value={filterSource} onChange={e => setFilterSource(e.target.value)}>
              <option value="">כל המקורות</option>
              <option value="credit">💳 כרטיס אשראי</option>
              <option value="bank">🏦 חשבון בנק</option>
            </select>
            <MultiCategoryFilter
              categories={categories}
              selected={filterCategories}
              onChange={setFilterCategories}
            />
            <button
              className={`filter-unclassified-btn ${filterUnclassified ? 'active' : ''}`}
              onClick={() => setFilterUnclassified(p => !p)}
            >
              ⚠️ לא מסווגים בלבד
            </button>
            {(filterMonth || filterCard || filterSource || filterCategories.length > 0 || filterUnclassified) && (
              <button className="filter-clear" onClick={() => { setFilterMonth(''); setFilterCard(''); setFilterSource(''); setFilterCategories([]); setFilterUnclassified(false); }}>
                ✕ נקה הכל
              </button>
            )}
          </div>

          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="bulk-bar">
              <span className="bulk-info">
                {selectedIds.size} פעולות מסומנות · ₪{fmt(selectedAmount)}
              </span>
              <button className="btn bulk-delete-btn" onClick={handleBulkDelete}>
                🗑️ מחק {selectedIds.size} מסומנים
              </button>
              <button className="btn btn-secondary bulk-clear-btn" onClick={() => setSelectedIds(new Set())}>
                בטל סימון
              </button>
            </div>
          )}

          {/* Transactions table */}
          <div className="card credit-table-card desktop-only">
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="cb-col">
                      <input
                        type="checkbox"
                        className="row-cb"
                        checked={isAllSelected}
                        ref={el => { if (el) el.indeterminate = isIndeterminate; }}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th>תאריך</th>
                    <th>תיאור</th>
                    <th>ענף</th>
                    <th>סכום</th>
                    <th>קטגוריה</th>
                    <th>כרטיס</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFiltered.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: '#aaa', padding: 24 }}>אין פעולות להצגה</td></tr>
                  ) : sortedFiltered.map(t => (
                    <tr key={t.id}
                      className={`${!t.category ? 'unclassified-row' : ''} ${selectedIds.has(t.id) ? 'selected-row' : ''}`}
                      onClick={() => toggleSelect(t.id)}
                    >
                      <td className="cb-col" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" className="row-cb" checked={selectedIds.has(t.id)} onChange={() => toggleSelect(t.id)} />
                      </td>
                      <td className="credit-date">
                        {normalizeDate(t.billingDate || t.date)}
                        {t.billingDate && t.date && t.billingDate !== t.date && (
                          <div className="credit-date-sub">עסקה: {normalizeDate(t.date)}</div>
                        )}
                      </td>
                      <td>{t.description}</td>
                      <td className="credit-branch">{t.branch || '—'}</td>
                      <td className="num">₪{fmt(t.amount)}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <CategorySelect value={t.category} onChange={cat => handleCategoryChange(t.id, cat)} categories={categories} />
                      </td>
                      <td>{t.sourceType === 'bank' ? '🏦' : '💳'} {t.cardName || '—'}</td>
                      <td className="actions-cell" onClick={e => e.stopPropagation()}>
                        <button className="icon-btn" onClick={() => handleDelete(t.id)}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {sortedFiltered.length > 0 && (
                  <tfoot>
                    <tr className="total-row">
                      <td /><td colSpan={3}><strong>סה"כ{(filterMonth || filterCard || filterCategories.length || filterSource || filterUnclassified) ? ' (מסונן)' : ''}</strong></td>
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
            {sortedFiltered.map(t => (
              <div key={t.id}
                className={`mcard ${!t.category ? 'unclassified-mcard' : ''} ${selectedIds.has(t.id) ? 'selected-mcard' : ''}`}
              >
                <div className="mcard-header">
                  <input type="checkbox" className="row-cb" checked={selectedIds.has(t.id)} onChange={() => toggleSelect(t.id)} />
                  <span className="mcard-name">{t.description}</span>
                  <span className="mcard-value">₪{fmt(t.amount)}</span>
                  <button className="icon-btn" onClick={() => handleDelete(t.id)}>🗑️</button>
                </div>
                <div className="mcard-row">
                  <div className="mcard-stat">
                    <span className="mcard-label">{t.billingDate ? 'תאריך חיוב' : 'תאריך'}</span>
                    <span className="mcard-value" style={{ fontSize: '0.85rem' }}>{normalizeDate(t.billingDate || t.date)}</span>
                  </div>
                  <div className="mcard-stat">
                    <CategorySelect value={t.category} onChange={cat => handleCategoryChange(t.id, cat)} categories={categories} />
                  </div>
                </div>
              </div>
            ))}
            {sortedFiltered.length > 0 && (
              <div className="mcard-total">
                <span>סה"כ</span>
                <span>₪{fmt(totalAmount)}</span>
              </div>
            )}
          </div>
        </>
      )}

      {showImport && (
        <ImportModal
          onImport={handleImport}
          onClose={() => setShowImport(false)}
          branchMap={branchMap}
          categories={categories}
        />
      )}

      {showSettings && (
        <CategorySettingsModal
          onClose={() => setShowSettings(false)}
          onSave={handleSaveSettings}
          initialCategories={categories}
          initialBranchMap={branchMap}
          knownBranches={knownBranches}
        />
      )}
    </div>
  );
}
