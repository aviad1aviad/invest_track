// Israeli financial benchmarks (sourced April 2026)
// Pension: max 0.5% accumulation, 6% deposit
// Hishtalmut/Gemel: good ≤0.3% accumulation, warn >0.5%, danger >1%
// Deposit fees: warn >3%, danger >5%
// Savings rate: good ≥20%, warn 10-19%, danger <10%
// Portfolio concentration: warn >50% single asset, danger >75%

const FOREIGN_CURRENCY_KEYWORDS = [
  'עולמי', 'גלובל', 'global', 'ארה"ב', 'ארהב', 'usa', 'אמריקה',
  's&p', 'סנפ', 'sp500', 'נאסד', 'nasdaq', 'ביטקוין', 'bitcoin',
  'אירו', 'דולר', 'dollar', 'euro', 'קריפטו', 'crypto',
];

function hasForeignExposure(name, type) {
  const text = `${name} ${type}`.toLowerCase();
  return FOREIGN_CURRENCY_KEYWORDS.some(k => text.includes(k.toLowerCase()));
}

function similarName(a, b) {
  const na = a.trim().toLowerCase();
  const nb = b.trim().toLowerCase();
  return na === nb || na.includes(nb) || nb.includes(na);
}

// ─── Expenses ────────────────────────────────────────────────────────────────
export function getExpenseInsights(expenses) {
  const insights = [];
  if (!expenses || expenses.length === 0) return insights;

  const total = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const foodTotal = expenses.filter(e => e.domain === 'אוכל').reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const savingsTotal = expenses.filter(e => e.domain === 'תיק השקעות').reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const baseTotal = total - foodTotal - savingsTotal;

  // Duplicate detection
  for (let i = 0; i < expenses.length; i++) {
    for (let j = i + 1; j < expenses.length; j++) {
      const a = expenses[i], b = expenses[j];
      const amountA = Number(a.amount) || 0;
      const amountB = Number(b.amount) || 0;
      const sameAmount = amountA > 0 && Math.abs(amountA - amountB) / Math.max(amountA, amountB) < 0.12;
      if (a.domain === b.domain && sameAmount && similarName(a.name, b.name)) {
        insights.push({ level: 'warning', text: `ייתכן כפילות: "${a.name}" ו-"${b.name}" בתחום ${a.domain} — סכומים דומים` });
      }
    }
  }

  // Domain concentration (excluding savings & food)
  const domainMap = {};
  expenses.filter(e => e.domain !== 'תיק השקעות' && e.domain !== 'אוכל').forEach(e => {
    domainMap[e.domain] = (domainMap[e.domain] || 0) + (Number(e.amount) || 0);
  });
  if (baseTotal > 0) {
    Object.entries(domainMap).forEach(([domain, amount]) => {
      const pct = (amount / baseTotal) * 100;
      if (pct > 50 && domain !== 'דיור') {
        insights.push({ level: 'warning', text: `תחום "${domain}" מהווה ${pct.toFixed(0)}% מהוצאות הבסיס — ריכוז גבוה` });
      }
    });
  }

  // No food domain
  if (foodTotal === 0) {
    insights.push({ level: 'info', text: 'לא נמצאו הוצאות בתחום אוכל — שקול להוסיף לצורך תמונה שלמה' });
  }

  // No savings domain
  if (savingsTotal === 0) {
    insights.push({ level: 'warning', text: 'לא נמצאו הוצאות בתחום תיק השקעות — האם החיסכון נרשם?' });
  }

  // Savings rate
  if (total > 0 && savingsTotal > 0) {
    const rate = (savingsTotal / total) * 100;
    if (rate >= 20) {
      insights.push({ level: 'good', text: `יחס חיסכון: ${rate.toFixed(0)}% — מעולה (יעד: 20%+)` });
    } else if (rate >= 10) {
      insights.push({ level: 'info', text: `יחס חיסכון: ${rate.toFixed(0)}% — מתחת ליעד המומלץ של 20%` });
    } else {
      insights.push({ level: 'danger', text: `יחס חיסכון: ${rate.toFixed(0)}% בלבד — מומלץ לפחות 20% מהכנסה` });
    }
  }

  // High housing cost
  const housingTotal = domainMap['דיור'] || 0;
  if (baseTotal > 0 && housingTotal > 0) {
    const housingPct = (housingTotal / baseTotal) * 100;
    if (housingPct > 40) {
      insights.push({ level: 'warning', text: `דיור מהווה ${housingPct.toFixed(0)}% מהוצאות הבסיס — מומלץ עד 30-35%` });
    }
  }

  if (insights.length === 0) {
    insights.push({ level: 'good', text: 'לא נמצאו בעיות בולטות בהוצאות הקבועות' });
  }
  return insights;
}

// ─── Savings ─────────────────────────────────────────────────────────────────
export function getSavingsInsights(savings) {
  const insights = [];
  if (!savings || savings.length === 0) return insights;

  // High accumulation fee
  savings.forEach(s => {
    const fee = Number(s.accumulationFee) || 0;
    if (fee > 1) {
      insights.push({ level: 'danger', text: `דמי ניהול צבירה של "${s.name}": ${fee}% — גבוה מאוד (מקסימום מומלץ: 0.5%)` });
    } else if (fee > 0.5) {
      insights.push({ level: 'warning', text: `דמי ניהול צבירה של "${s.name}": ${fee}% — מעל הממוצע (ממוצע טוב: 0.2-0.3%)` });
    }
  });

  // High deposit fee
  savings.forEach(s => {
    const fee = Number(s.depositFee) || 0;
    if (fee > 5) {
      insights.push({ level: 'danger', text: `דמי ניהול הפקדה של "${s.name}": ${fee}% — גבוה מאוד (מקסימום: 6%)` });
    } else if (fee > 3) {
      insights.push({ level: 'warning', text: `דמי ניהול הפקדה של "${s.name}": ${fee}% — מעל הממוצע המומלץ` });
    }
  });

  // Missing deposits data
  const missingDeposits = savings.filter(s => !Number(s.totalDeposits));
  if (missingDeposits.length > 0) {
    insights.push({ level: 'info', text: `${missingDeposits.length} חיסכון/ות ללא נתוני הפקדות — לא ניתן לחשב תשואה` });
  }

  // Track concentration
  const types = savings.map(s => s.type).filter(Boolean);
  const uniqueTypes = [...new Set(types)];
  if (savings.length >= 2 && uniqueTypes.length === 1) {
    insights.push({ level: 'warning', text: `כל החסכונות במסלול אחד (${uniqueTypes[0]}) — שקול פיזור מסלולים` });
  }

  // Negative return
  savings.forEach(s => {
    const current = Number(s.currentAmount) || 0;
    const deposits = Number(s.totalDeposits) || 0;
    if (deposits > 0 && current < deposits) {
      const loss = ((deposits - current) / deposits * 100).toFixed(1);
      insights.push({ level: 'warning', text: `"${s.name}" בהפסד של ${loss}% — שווי נוכחי נמוך מסך ההפקדות` });
    }
  });

  // Good accumulation fees
  const goodFees = savings.filter(s => Number(s.accumulationFee) > 0 && Number(s.accumulationFee) <= 0.3);
  if (goodFees.length > 0 && goodFees.length === savings.filter(s => Number(s.accumulationFee) > 0).length) {
    insights.push({ level: 'good', text: `דמי ניהול צבירה תקינים בכל החסכונות (≤0.3%)` });
  }

  if (insights.length === 0) {
    insights.push({ level: 'good', text: 'לא נמצאו בעיות בולטות בחסכונות' });
  }
  return insights;
}

// ─── Investments ──────────────────────────────────────────────────────────────
export function getInvestmentInsights(investments, calcCurrentValueFn) {
  const insights = [];
  if (!investments || investments.length === 0) return insights;

  const withValue = investments.map(inv => ({
    ...inv,
    val: calcCurrentValueFn(inv) ?? 0,
  }));
  const totalVal = withValue.reduce((s, inv) => s + inv.val, 0);

  // Concentration risk
  withValue.forEach(inv => {
    if (totalVal > 0 && inv.val > 0) {
      const pct = (inv.val / totalVal) * 100;
      if (pct > 75) {
        insights.push({ level: 'danger', text: `"${inv.name}" מהווה ${pct.toFixed(0)}% מהתיק — ריכוז גבוה מאוד` });
      } else if (pct > 50) {
        insights.push({ level: 'warning', text: `"${inv.name}" מהווה ${pct.toFixed(0)}% מהתיק — שקול פיזור` });
      }
    }
  });

  // Type diversification
  const types = [...new Set(investments.map(inv => inv.type).filter(Boolean))];
  if (investments.length >= 3 && types.length === 1) {
    insights.push({ level: 'warning', text: `כל ההשקעות מסוג אחד (${types[0]}) — שקול פיזור לסוגים נוספים` });
  }

  // Foreign currency exposure
  const foreignCount = investments.filter(inv => hasForeignExposure(inv.name, inv.type || '')).length;
  const foreignPct = investments.length > 0 ? (foreignCount / investments.length) * 100 : 0;
  if (foreignCount === 0 && investments.length >= 2) {
    insights.push({ level: 'info', text: 'לא זוהתה חשיפה למטבע חוץ — שקול הוספת נכסים גלובליים לגידור סיכון' });
  } else if (foreignPct > 80) {
    insights.push({ level: 'warning', text: `חשיפה גבוהה למטבע חוץ (${foreignPct.toFixed(0)}% מהנכסים) — שקול פיזור מקומי` });
  } else if (foreignCount > 0) {
    insights.push({ level: 'good', text: `יש חשיפה למטבע חוץ — פיזור גיאוגרפי תקין` });
  }

  // High management fees
  investments.forEach(inv => {
    const fee = Number(inv.accumulationFee) || 0;
    if (fee > 0.5) {
      insights.push({ level: 'warning', text: `דמי ניהול של "${inv.name}": ${fee}% — מעל 0.5% המומלץ` });
    }
  });

  // Missing price data
  const missingVal = investments.filter(inv => calcCurrentValueFn(inv) === null);
  if (missingVal.length > 0) {
    insights.push({ level: 'info', text: `${missingVal.length} השקעה/ות ללא נתוני מחיר — שווי התיק חלקי` });
  }

  if (insights.length === 0) {
    insights.push({ level: 'good', text: 'לא נמצאו בעיות בולטות בתיק ההשקעות' });
  }
  return insights;
}

// ─── Dashboard summary ────────────────────────────────────────────────────────
export function getDashboardInsights(state) {
  const insights = [];
  const { expenses = [], incomes = [], savings = [], investments = [] } = state;

  const totalExpenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const totalIncomes = incomes.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const savingsExpense = expenses.filter(e => e.domain === 'תיק השקעות').reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const balance = totalIncomes - totalExpenses;

  // No incomes entered
  if (totalIncomes === 0) {
    insights.push({ level: 'info', text: 'לא הוזנו הכנסות — הוסף הכנסות לקבלת תמונה פיננסית מלאה' });
  }

  // Balance
  if (totalIncomes > 0) {
    if (balance < 0) {
      insights.push({ level: 'danger', text: `מאזן שלילי: ₪${Math.abs(balance).toLocaleString('he-IL')} — ההוצאות עולות על ההכנסות` });
    } else if (balance / totalIncomes < 0.1) {
      insights.push({ level: 'warning', text: `מאזן צפוף: נשאר רק ${((balance / totalIncomes) * 100).toFixed(0)}% מההכנסה — מרחב צר` });
    } else {
      insights.push({ level: 'good', text: `מאזן חיובי: ₪${balance.toLocaleString('he-IL')} (${((balance / totalIncomes) * 100).toFixed(0)}% מההכנסה)` });
    }

    // Savings rate
    if (savingsExpense > 0) {
      const rate = (savingsExpense / totalIncomes) * 100;
      if (rate >= 20) {
        insights.push({ level: 'good', text: `יחס חיסכון: ${rate.toFixed(0)}% — מצוין` });
      } else if (rate >= 10) {
        insights.push({ level: 'info', text: `יחס חיסכון: ${rate.toFixed(0)}% — מתחת ליעד 20%` });
      } else {
        insights.push({ level: 'warning', text: `יחס חיסכון נמוך: ${rate.toFixed(0)}% — מומלץ לפחות 20%` });
      }
    }
  }

  // No savings
  if (savings.length === 0 && investments.length === 0) {
    insights.push({ level: 'warning', text: 'אין חסכונות או השקעות רשומות — הוסף כדי לעקוב אחר ההון הצבור' });
  }

  return insights.slice(0, 4);
}
