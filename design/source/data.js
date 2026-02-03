// CURS — simplified data model
// 3 asset classes: tradfi (traditional finance), crypto, fiat (currencies)
// Transactions: in (deposit), out (withdraw), tx (swap one for another), div (dividend cashflow)
(function () {
  // ---------- Seeded RNG ----------
  function mulberry32(seed) {
    return function () {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- Dates ----------
  const today = new Date('2026-05-22T12:00:00Z');
  function daysAgo(n) { return new Date(today.getTime() - n * 86400000); }
  function fmtDate(d) { return d.toISOString().slice(0, 10); }

  // ---------- GBM price series ----------
  const DAYS = 365;
  function genSeries(seed, start, mu, sigma, end) {
    const rnd = mulberry32(seed);
    function norm() {
      const u1 = Math.max(1e-9, rnd()), u2 = rnd();
      return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    }
    const out = [];
    let px = start;
    for (let i = DAYS - 1; i >= 0; i--) {
      const z = norm();
      px = px * (1 + mu / 252 + (sigma / Math.sqrt(252)) * z);
      out.push({ d: daysAgo(i), v: px });
    }
    // Rescale so final value matches `end`
    const lastSim = out[out.length - 1].v;
    const scale = end / lastSim;
    return out.map(p => ({ d: p.d, v: p.v * scale }));
  }

  // ---------- Asset universe ----------
  // class: 'tradfi' | 'crypto' | 'fiat'
  // For tradfi/crypto: price = current price in `ccy`
  // For fiat: price is rate to base (RUB); fiat assets value 1 unit of themselves
  const ASSETS = [
    // Fiat (currencies)
    { id: 'RUB', name: 'Рубль',  class: 'fiat', ccy: 'RUB', icon: 'a-rub', price: 1,      seed: 31, mu: 0,     sigma: 0    },
    { id: 'USD', name: 'Доллар', class: 'fiat', ccy: 'USD', icon: 'a-usd', price: 93.20,  seed: 32, mu: 0.04,  sigma: 0.08 },
    { id: 'EUR', name: 'Евро',   class: 'fiat', ccy: 'EUR', icon: 'a-eur', price: 102.50, seed: 33, mu: 0.03,  sigma: 0.07 },

    // Tradfi — stocks, bonds, etfs grouped together
    { id: 'SBER',     name: 'Сбербанк',      class: 'tradfi', sub: 'Акция',     ccy: 'RUB', icon: 'a-sber', price: 332.40,  seed: 11, mu: 0.18,  sigma: 0.28, start: 230  },
    { id: 'YNDX',     name: 'Яндекс',        class: 'tradfi', sub: 'Акция',     ccy: 'RUB', icon: 'a-yndx', price: 4318.0,  seed: 13, mu: 0.32,  sigma: 0.36, start: 2900 },
    { id: 'LKOH',     name: 'Лукойл',        class: 'tradfi', sub: 'Акция',     ccy: 'RUB', icon: 'a-lkoh', price: 7416.0,  seed: 14, mu: 0.10,  sigma: 0.22, start: 6800 },
    { id: 'GAZP',     name: 'Газпром',       class: 'tradfi', sub: 'Акция',     ccy: 'RUB', icon: 'a-gazp', price: 142.18,  seed: 12, mu: -0.08, sigma: 0.32, start: 165  },
    { id: 'AAPL',     name: 'Apple',         class: 'tradfi', sub: 'Акция',     ccy: 'USD', icon: 'a-aapl', price: 232.55,  seed: 15, mu: 0.20,  sigma: 0.24, start: 175  },
    { id: 'NVDA',     name: 'NVIDIA',        class: 'tradfi', sub: 'Акция',     ccy: 'USD', icon: 'a-nvda', price: 168.91,  seed: 16, mu: 0.85,  sigma: 0.42, start: 64   },
    { id: 'OFZ26240', name: 'ОФЗ-26240',     class: 'tradfi', sub: 'Облигация', ccy: 'RUB', icon: 'a-ofz',  price: 71.85,   seed: 19, mu: 0.10,  sigma: 0.06, start: 65   },
    { id: 'VTBR',     name: 'VTB ETF Корп',  class: 'tradfi', sub: 'ETF',       ccy: 'RUB', icon: 'a-vtbr', price: 113.25,  seed: 27, mu: 0.08,  sigma: 0.05, start: 108  },

    // Crypto
    { id: 'BTC', name: 'Bitcoin',  class: 'crypto', ccy: 'USD', icon: 'a-btc', price: 96420, seed: 17, mu: 0.55, sigma: 0.58, start: 45000 },
    { id: 'ETH', name: 'Ethereum', class: 'crypto', ccy: 'USD', icon: 'a-eth', price: 3215,  seed: 18, mu: 0.40, sigma: 0.65, start: 2300  },
    { id: 'SOL', name: 'Solana',   class: 'crypto', ccy: 'USD', icon: 'a-sol', price: 213,   seed: 22, mu: 0.60, sigma: 0.85, start: 90    },
  ];

  // Pre-generate price series (in trading ccy)
  ASSETS.forEach(a => {
    if (a.class === 'fiat') {
      // For fiat assets we still produce a series (rate to base for analytics).
      a.series = genSeries(a.seed, a.price * 0.92, a.mu, a.sigma, a.price);
    } else {
      a.series = genSeries(a.seed, a.start, a.mu, a.sigma, a.price);
    }
  });

  function asset(id) { return ASSETS.find(a => a.id === id); }

  // ---------- Rates ----------
  // Convert a value in `ccy` to base (RUB).
  const BASE = 'RUB';
  function rateToBase(ccy) {
    if (ccy === BASE) return 1;
    const fiat = ASSETS.find(a => a.class === 'fiat' && a.ccy === ccy);
    return fiat ? fiat.price : 1;
  }

  // Value (in base RUB) of `qty` units of an asset at its current price
  function valueInBase(assetId, qty) {
    const a = asset(assetId);
    if (a.class === 'fiat') {
      // For fiat assets, qty is in that currency's units → multiply by rate
      return qty * rateToBase(a.ccy);
    }
    return qty * a.price * rateToBase(a.ccy);
  }

  // ---------- Portfolios ----------
  // Positions: { assetId, qty, avgPrice (in trading ccy for tradfi/crypto; in self ccy for fiat = 1) }
  const PORTFOLIOS = [
    {
      id: 'main', name: 'Основной', color: '#15140F',
      positions: [
        { assetId: 'RUB',  qty: 145000,  avgPrice: 1 },
        { assetId: 'USD',  qty: 1850,    avgPrice: 88.40 },
        { assetId: 'SBER', qty: 420,     avgPrice: 245.0 },
        { assetId: 'YNDX', qty: 14,      avgPrice: 3200.0 },
        { assetId: 'LKOH', qty: 26,      avgPrice: 7100.0 },
        { assetId: 'GAZP', qty: 1100,    avgPrice: 158.0 },
        { assetId: 'AAPL', qty: 38,      avgPrice: 184.5 },
        { assetId: 'NVDA', qty: 95,      avgPrice: 91.2 },
        { assetId: 'BTC',  qty: 0.42,    avgPrice: 62400 },
        { assetId: 'ETH',  qty: 4.1,     avgPrice: 2640 },
      ],
    },
    {
      id: 'long', name: 'Долгосрочный', color: '#2F4858',
      positions: [
        { assetId: 'RUB',      qty: 38000, avgPrice: 1 },
        { assetId: 'OFZ26240', qty: 3400,  avgPrice: 68.0 },
        { assetId: 'VTBR',     qty: 1820,  avgPrice: 109.5 },
        { assetId: 'LKOH',     qty: 14,    avgPrice: 6900.0 },
      ],
    },
    {
      id: 'crypto', name: 'Крипта', color: '#EE7544',
      positions: [
        { assetId: 'USD', qty: 320,  avgPrice: 89.0 },
        { assetId: 'BTC', qty: 0.18, avgPrice: 73000 },
        { assetId: 'ETH', qty: 6.0,  avgPrice: 3100 },
        { assetId: 'SOL', qty: 42,   avgPrice: 145 },
      ],
    },
  ];

  // ---------- Position calculations ----------
  function valueOfPosition(pos) {
    const a = asset(pos.assetId);
    const valBase = valueInBase(pos.assetId, pos.qty);
    let costBase;
    if (a.class === 'fiat') {
      // cost = qty units bought at avgPrice (rate at time of purchase)
      costBase = pos.qty * pos.avgPrice;
    } else {
      // cost = qty × avgPrice (in trading ccy) → to base via current rate (simplified)
      costBase = pos.qty * pos.avgPrice * rateToBase(a.ccy);
    }
    const pl = valBase - costBase;
    const plPct = costBase > 0 ? pl / costBase : 0;
    // 1-day change from series
    const s = a.series;
    const dayPct = s.length > 1 ? s[s.length - 1].v / s[s.length - 2].v - 1 : 0;
    return {
      asset: a, qty: pos.qty, avgPrice: pos.avgPrice,
      valBase, costBase, pl, plPct, dayPct
    };
  }

  function portfolioValue(p) {
    const positions = p.positions.map(valueOfPosition);
    const total     = positions.reduce((s, x) => s + x.valBase, 0);
    const totalCost = positions.reduce((s, x) => s + x.costBase, 0);
    const dayPl     = positions.reduce((s, x) => s + x.valBase * x.dayPct, 0);
    return {
      ...p, positions, total, totalCost,
      pl: total - totalCost,
      plPct: totalCost > 0 ? (total - totalCost) / totalCost : 0,
      dayPl, dayPct: total > 0 ? dayPl / (total - dayPl) : 0,
    };
  }

  // Build a portfolio equity curve (in base ccy)
  function portfolioSeries(p) {
    const out = new Array(DAYS).fill(0).map((_, i) => ({ d: daysAgo(DAYS - 1 - i), v: 0 }));
    p.positions.forEach(pos => {
      const a = asset(pos.assetId);
      if (a.class === 'fiat') {
        // value in base = qty × rate_at_time
        const rate = a.series; // for fiat the series is rate-to-base
        for (let i = 0; i < DAYS; i++) out[i].v += pos.qty * rate[i].v;
      } else {
        const fxA = ASSETS.find(x => x.class === 'fiat' && x.ccy === a.ccy);
        const fxSeries = fxA ? fxA.series : null;
        for (let i = 0; i < DAYS; i++) {
          const fx = a.ccy === BASE ? 1 : (fxSeries ? fxSeries[i].v : rateToBase(a.ccy));
          out[i].v += a.series[i].v * pos.qty * fx;
        }
      }
    });
    return out;
  }
  PORTFOLIOS.forEach(p => { p.series = portfolioSeries(p); });

  // ---------- Transactions ----------
  // Types:
  //   in   — пополнение (deposit fiat)
  //   out  — вывод      (withdraw fiat)
  //   tx   — транзакция (swap one asset for another) — covers buy/sell naturally
  //   div  — дивиденд   (cash inflow attributed to a tradfi/crypto asset)
  //
  // Shape:
  //   in/out: { type, portfolio, d, asset, qty }
  //   tx:     { type, portfolio, d, from:{asset,qty}, to:{asset,qty} }
  //   div:    { type, portfolio, d, source, cashAsset, qty }
  const TX = [
    // recent
    { id: 't1',  d: daysAgo(2),  type: 'tx',  portfolio: 'main',
      from: { asset: 'RUB', qty: 230000 }, to: { asset: 'NVDA', qty: 15 } },
    { id: 't2',  d: daysAgo(5),  type: 'div', portfolio: 'main', source: 'SBER', cashAsset: 'RUB', qty: 3528 },
    { id: 't3',  d: daysAgo(7),  type: 'tx',  portfolio: 'crypto',
      from: { asset: 'USD', qty: 4640 }, to: { asset: 'BTC', qty: 0.05 } },
    { id: 't4',  d: daysAgo(11), type: 'tx',  portfolio: 'main',
      from: { asset: 'GAZP', qty: 200 }, to: { asset: 'RUB', qty: 29140 } },
    { id: 't5',  d: daysAgo(14), type: 'in',  portfolio: 'main', asset: 'RUB', qty: 200000 },
    { id: 't6',  d: daysAgo(21), type: 'tx',  portfolio: 'long',
      from: { asset: 'RUB', qty: 14080 }, to: { asset: 'OFZ26240', qty: 200 } },
    { id: 't7',  d: daysAgo(28), type: 'div', portfolio: 'main', source: 'LKOH', cashAsset: 'RUB', qty: 13624 },
    { id: 't8',  d: daysAgo(36), type: 'tx',  portfolio: 'crypto',
      from: { asset: 'ETH', qty: 1.5 }, to: { asset: 'USD', qty: 4470 } },
    { id: 't9',  d: daysAgo(45), type: 'out', portfolio: 'main', asset: 'USD', qty: 1200 },
    { id: 't10', d: daysAgo(58), type: 'tx',  portfolio: 'main',
      from: { asset: 'RUB', qty: 15400 }, to: { asset: 'YNDX', qty: 4 } },
    { id: 't11', d: daysAgo(72), type: 'div', portfolio: 'long', source: 'OFZ26240', cashAsset: 'RUB', qty: 12200 },
    { id: 't12', d: daysAgo(90), type: 'tx',  portfolio: 'main',
      from: { asset: 'USD', qty: 1980 }, to: { asset: 'AAPL', qty: 10 } },
    { id: 't13', d: daysAgo(118), type: 'tx', portfolio: 'main',
      from: { asset: 'USD', qty: 5760 }, to: { asset: 'BTC', qty: 0.08 } },
    { id: 't14', d: daysAgo(150), type: 'tx', portfolio: 'long',
      from: { asset: 'RUB', qty: 90200 }, to: { asset: 'VTBR', qty: 820 } },
    { id: 't15', d: daysAgo(180), type: 'in', portfolio: 'main', asset: 'USD', qty: 4000 },
    { id: 't16', d: daysAgo(220), type: 'div', portfolio: 'main', source: 'AAPL', cashAsset: 'USD', qty: 38 },
    { id: 't17', d: daysAgo(260), type: 'tx', portfolio: 'crypto',
      from: { asset: 'USD', qty: 6090 }, to: { asset: 'SOL', qty: 42 } },
    { id: 't18', d: daysAgo(310), type: 'in', portfolio: 'long', asset: 'RUB', qty: 250000 },
  ];

  // ---------- Metrics (used by Analytics tab) ----------
  function metricsFor(p) {
    const s = p.series;
    const rets = [];
    for (let i = 1; i < s.length; i++) rets.push(s[i].v / s[i - 1].v - 1);
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    const variance = rets.reduce((a, b) => a + (b - mean) * (b - mean), 0) / rets.length;
    const vol = Math.sqrt(variance) * Math.sqrt(252);
    const annRet = s[s.length - 1].v / s[0].v - 1;
    const sharpe = vol > 0 ? (annRet - 0.07) / vol : 0;
    let peak = s[0].v, maxDD = 0;
    s.forEach(pt => { if (pt.v > peak) peak = pt.v; const dd = (pt.v - peak) / peak; if (dd < maxDD) maxDD = dd; });
    return { vol, sharpe, annRet, maxDD };
  }
  PORTFOLIOS.forEach(p => { p.metrics = metricsFor(p); });

  // Correlation matrix among given asset ids
  function corrMatrix(assetIds) {
    const series = assetIds.map(id => asset(id).series);
    const rets = series.map(s => {
      const r = [];
      for (let i = 1; i < s.length; i++) r.push(Math.log(s[i].v / s[i - 1].v));
      return r;
    });
    function mean(a) { return a.reduce((s, x) => s + x, 0) / a.length; }
    function corr(a, b) {
      const ma = mean(a), mb = mean(b);
      let num = 0, da = 0, db = 0;
      for (let i = 0; i < a.length; i++) {
        num += (a[i] - ma) * (b[i] - mb);
        da += (a[i] - ma) ** 2;
        db += (b[i] - mb) ** 2;
      }
      return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0;
    }
    return rets.map(a => rets.map(b => corr(a, b)));
  }

  // ---------- Formatting ----------
  function fmtRUB(v, opts = {}) {
    const { sign = false, compact = false, decimals = 0 } = opts;
    const abs = Math.abs(v);
    let str;
    if (compact && abs >= 1e6)      str = (v / 1e6).toFixed(2).replace('.', ',') + ' млн';
    else if (compact && abs >= 1e3) str = (v / 1e3).toFixed(1).replace('.', ',') + 'к';
    else {
      str = Math.round(v * Math.pow(10, decimals)) / Math.pow(10, decimals);
      str = str.toLocaleString('ru-RU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    }
    return (sign && v > 0 ? '+' : '') + str + ' ₽';
  }
  function fmtCcy(v, ccy, opts = {}) {
    if (ccy === 'RUB') return fmtRUB(v, opts);
    const { sign = false, decimals = 2 } = opts;
    const sym = { USD: '$', EUR: '€' }[ccy] || '';
    const num = v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return (sign && v > 0 ? '+' : '') + sym + num;
  }
  function fmtQty(q, decimals) {
    if (decimals != null) return q.toLocaleString('ru-RU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    if (Math.abs(q) >= 1) return q.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
    return q.toLocaleString('ru-RU', { maximumFractionDigits: 6 });
  }
  function fmtPct(v, opts = {}) {
    const { sign = true, decimals = 2 } = opts;
    const x = (v * 100).toFixed(decimals).replace('.', ',');
    return (sign && v > 0 ? '+' : '') + x + '%';
  }

  // ---------- Class labels & helpers ----------
  const CLASS_LABEL = { tradfi: 'Трад. финансы', crypto: 'Крипта', fiat: 'Валюта' };
  const CLASS_COLOR = { tradfi: '#15140F', crypto: '#EE7544', fiat: '#86B0A0' };

  window.CURS_DATA = {
    today, daysAgo, fmtDate, DAYS, BASE,
    ASSETS, PORTFOLIOS, TX,
    asset, rateToBase, valueInBase,
    valueOfPosition, portfolioValue, corrMatrix,
    fmtRUB, fmtCcy, fmtPct, fmtQty,
    CLASS_LABEL, CLASS_COLOR,
  };
})();
