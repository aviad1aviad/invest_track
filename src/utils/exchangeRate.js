const BASE = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api';

async function fetchRate(dateStr) {
  const url = `${BASE}@${dateStr}/v1/currencies/usd.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`שגיאה בשליפת שער דולר (${dateStr})`);
  const data = await res.json();
  const rate = data?.usd?.ils;
  if (!rate) throw new Error('לא נמצא שער USD/ILS');
  return Math.round(rate * 1000) / 1000;
}

export async function getCurrentRate() {
  return fetchRate('latest');
}

export async function getHistoricalRate(date) {
  // date: Date object or 'YYYY-MM-DD' string
  const dateStr = date instanceof Date
    ? date.toISOString().slice(0, 10)
    : date;
  return fetchRate(dateStr);
}
