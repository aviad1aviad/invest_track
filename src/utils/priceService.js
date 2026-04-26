// Fetches current price via Yahoo Finance (proxied through CRA dev server / netlify.toml)
// All investments assumed to be on TASE — ticker = securityNumber + ".TA"

function buildTicker(inv) {
  if (!inv.securityNumber) return null;
  return `${inv.securityNumber.trim()}.TA`;
}

export async function fetchPrice(ticker) {
  const url = `/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
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
      const ticker = buildTicker(inv);
      if (!ticker) return { id: inv.id, skipped: true };
      const { price, currency } = await fetchPrice(ticker);
      return { id: inv.id, price, currency, ticker };
    })
  );

  return results.map((r, i) => ({
    id: investments[i].id,
    ticker: buildTicker(investments[i]),
    ...(r.status === 'fulfilled' ? r.value : { error: r.reason?.message || 'שגיאה' }),
  }));
}
