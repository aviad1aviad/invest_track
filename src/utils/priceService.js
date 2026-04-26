// Fetches current price via Yahoo Finance (proxied through CRA dev server)
// Ticker examples:
//   Israeli TASE securities: "5122510.TA"
//   Bitcoin: "BTC-USD" or "BTC-ILS"
//   Global ETF: "VWRL.L", "IWDA.AS"

export async function fetchPrice(ticker) {
  if (!ticker || !ticker.trim()) throw new Error('אין טיקר');

  const url = `/v8/finance/chart/${encodeURIComponent(ticker.trim())}?interval=1d&range=1d`;
  const res = await fetch(url);

  if (!res.ok) throw new Error(`שגיאת רשת: ${res.status}`);

  const data = await res.json();
  const result = data?.chart?.result?.[0];

  if (!result) throw new Error('הנייר לא נמצא');

  const price = result.meta?.regularMarketPrice;
  const currency = result.meta?.currency;

  if (!price) throw new Error('לא נמצא מחיר');

  return { price, currency };
}

export async function fetchPrices(investments) {
  const results = await Promise.allSettled(
    investments.map(async inv => {
      if (!inv.ticker) return { id: inv.id, skipped: true };
      const { price, currency } = await fetchPrice(inv.ticker);
      return { id: inv.id, price, currency, ticker: inv.ticker };
    })
  );

  return results.map((r, i) => ({
    id: investments[i].id,
    ticker: investments[i].ticker,
    ...(r.status === 'fulfilled' ? r.value : { error: r.reason?.message || 'שגיאה' }),
  }));
}
