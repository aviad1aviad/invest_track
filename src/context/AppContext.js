import React, { createContext, useContext, useReducer, useEffect, useState } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const AppContext = createContext();

const INITIAL_STATE = {
  expenses: [],
  savings: [],
  investments: [],
  incomes: [],
};

const DOC_REF = doc(db, 'userData', 'main');

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD':
      return { ...INITIAL_STATE, ...action.payload };

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

  // Load from Firestore on mount, fall back to localStorage
  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(DOC_REF);
        if (snap.exists()) {
          dispatch({ type: 'LOAD', payload: snap.data() });
        } else {
          // First time on Firestore — migrate localStorage data if any
          const local = localStorage.getItem('investTrackData');
          if (local) {
            const parsed = JSON.parse(local);
            dispatch({ type: 'LOAD', payload: parsed });
          }
        }
      } catch {
        // Offline or error — fall back to localStorage
        const local = localStorage.getItem('investTrackData');
        if (local) dispatch({ type: 'LOAD', payload: JSON.parse(local) });
      } finally {
        setLoading(false);
        setInitialized(true);
      }
    }
    load();
  }, []);

  // Save to Firestore + localStorage whenever state changes (after initial load)
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
