import React, { createContext, useContext, useReducer, useEffect } from 'react';

const AppContext = createContext();

const INITIAL_STATE = {
  expenses: [],
  savings: [],
  investments: [],
};

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD':
      return action.payload;

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

    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  useEffect(() => {
    const saved = localStorage.getItem('investTrackData');
    if (saved) dispatch({ type: 'LOAD', payload: JSON.parse(saved) });
  }, []);

  useEffect(() => {
    localStorage.setItem('investTrackData', JSON.stringify(state));
  }, [state]);

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useApp() {
  return useContext(AppContext);
}
