import React, { createContext, useContext, useReducer, useEffect, useState } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const AppContext = createContext();

const INITIAL_STATE = {
  expenses: [],
  savings: [],
  investments: [],
  incomes: [],
  snapshots: [],
};

const DOC_REF = doc(db, 'userData', 'main');

function calcInvValue(inv) {
  if (inv.currency === 'USD') {
    const usd = Number(inv.currentValueUSD) || 0;
    const rate = Number(inv.currentExchangeRate) || 0;
    return usd && rate ? usd * rate : 0;
  }
  if (inv.entryType === 'provident') return Number(inv.currentValue) || 0;
  const units = Number(inv.unitCount) || 0;
  const agorot = Number(inv.unitPriceAgorot) || 0;
  return units && agorot ? (units * agorot) / 100 : 0;
}

function getInvDeposits(inv) {
  if (inv.currency === 'USD' && inv.lots?.length > 0)
    return inv.lots.reduce((s, l) => s + (Number(l.amountILS) || 0), 0);
  return Number(inv.totalDeposits) || 0;
}

function buildSnapshot(data) {
  const savingsDetail = (data.savings || []).map(sv => ({
    id: sv.id,
    name: sv.name,
    amount: Math.round(Number(sv.currentAmount) || 0),
    deposits: Math.round(Number(sv.totalDeposits) || 0),
  }));

  const investmentsDetail = (data.investments || []).map(inv => ({
    id: inv.id,
    name: inv.name,
    valueILS: Math.round(calcInvValue(inv)),
    deposits: Math.round(getInvDeposits(inv)),
  }));

  const totalSavings = savingsDetail.reduce((s, sv) => s + sv.amount, 0);
  const totalInvestments = investmentsDetail.reduce((s, inv) => s + inv.valueILS, 0);

  return {
    date: new Date().toISOString().slice(0, 10),
    totalSavings,
    totalInvestments,
    grandTotal: totalSavings + totalInvestments,
    savingsDetail,
    investmentsDetail,
  };
}

function isSnapshotDue(snapshots) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = today.getDate();
  const year = today.getFullYear();
  const month = today.getMonth();

  const lastScheduled = day >= 20
    ? new Date(year, month, 20)
    : new Date(year, month, 1);
  lastScheduled.setHours(0, 0, 0, 0);

  if (!snapshots || snapshots.length === 0) return true;

  const lastDate = new Date(snapshots[snapshots.length - 1].date);
  lastDate.setHours(0, 0, 0, 0);

  return lastDate < lastScheduled;
}

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD':
      return { ...INITIAL_STATE, ...action.payload };

    case 'ADD_SNAPSHOT':
      return { ...state, snapshots: [...(state.snapshots || []), action.payload] };

    case 'ADD_EXPENSE':
      return { ...state, expenses: [...state.expenses, { ...action.payload, id: Date.now() }] };
    case 'UPDATE_EXPENSE':
      return { ...state, expenses: state.expenses.map(e => e.id === action.payload.id ? action.payload : e) };
    case 'DELETE_EXPENSE':
      return { ...state, expenses: state.expenses.filter(e => e.id !== action.payload) };

    case 'ADD_SAVING':
      return { ...state, savings: [...state.savings, { ...action.payload, id: Date.now() }] };
    case 'UPDATE_SAVING':
      return { ...state, savings: state.savings.map(s => s.id === action.payload.id ? action.payload : s) };
    case 'DELETE_SAVING':
      return { ...state, savings: state.savings.filter(s => s.id !== action.payload) };

    case 'ADD_INVESTMENT':
      return { ...state, investments: [...state.investments, { ...action.payload, id: Date.now() }] };
    case 'UPDATE_INVESTMENT':
      return { ...state, investments: state.investments.map(i => i.id === action.payload.id ? action.payload : i) };
    case 'DELETE_INVESTMENT':
      return { ...state, investments: state.investments.filter(i => i.id !== action.payload) };
    case 'ADD_INVESTMENT_LOT': {
      const { investmentId, lot } = action.payload;
      return {
        ...state,
        investments: state.investments.map(inv =>
          inv.id === investmentId
            ? { ...inv, lots: [...(inv.lots || []), { ...lot, id: Date.now() }] }
            : inv
        ),
      };
    }
    case 'DELETE_INVESTMENT_LOT': {
      const { investmentId, lotId } = action.payload;
      return {
        ...state,
        investments: state.investments.map(inv =>
          inv.id === investmentId
            ? { ...inv, lots: (inv.lots || []).filter(l => l.id !== lotId) }
            : inv
        ),
      };
    }

    case 'ADD_INCOME':
      return { ...state, incomes: [...state.incomes, { ...action.payload, id: Date.now() }] };
    case 'UPDATE_INCOME':
      return { ...state, incomes: state.incomes.map(i => i.id === action.payload.id ? action.payload : i) };
    case 'DELETE_INCOME':
      return { ...state, incomes: state.incomes.filter(i => i.id !== action.payload) };

    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    async function load() {
      let data = null;
      try {
        const snap = await getDoc(DOC_REF);
        if (snap.exists()) {
          data = snap.data();
        } else {
          const local = localStorage.getItem('investTrackData');
          if (local) data = JSON.parse(local);
        }
      } catch {
        const local = localStorage.getItem('investTrackData');
        if (local) data = JSON.parse(local);
      }

      if (data) {
        dispatch({ type: 'LOAD', payload: data });
        if (isSnapshotDue(data.snapshots || [])) {
          dispatch({ type: 'ADD_SNAPSHOT', payload: buildSnapshot(data) });
        }
      }

      setLoading(false);
      setInitialized(true);
    }
    load();
  }, []);

  useEffect(() => {
    if (!initialized) return;
    localStorage.setItem('investTrackData', JSON.stringify(state));
    setSyncing(true);
    setDoc(DOC_REF, state)
      .catch(() => {})
      .finally(() => setSyncing(false));
  }, [state, initialized]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'inherit', color: '#555', direction: 'rtl' }}>
        טוען נתונים...
      </div>
    );
  }

  return (
    <AppContext.Provider value={{ state, dispatch, syncing }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
