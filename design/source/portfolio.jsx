// CURS — Portfolio screen (positions + transactions, with add buttons)
const { useState: pfUseState, useMemo: pfUseMemo } = React;

function PortfolioScreen({ portfolio, onAddAsset, onAddTx, onOpenPosition }) {
  const [classFilter, setClassFilter] = pfUseState('all');
  const [sort, setSort] = pfUseState({ key: 'value', dir: 'desc' });

  const pv = pfUseMemo(() => CURS_DATA.portfolioValue(portfolio), [portfolio]);

  // 90-day delta
  const series = portfolio.series.slice(-90);
  const startV = series[0].v;
  const deltaPct = (pv.total - startV) / startV;

  // Filter & sort
  const filtered = pv.positions
    .filter(p => classFilter === 'all' || p.asset.class === classFilter)
    .slice()
    .sort((a, b) => {
      const dir = sort.dir === 'desc' ? -1 : 1;
      if (sort.key === 'value') return (a.valBase - b.valBase) * dir;
      if (sort.key === 'pl')    return (a.plPct - b.plPct) * dir;
      if (sort.key === 'class') return a.asset.class.localeCompare(b.asset.class) * dir;
      return 0;
    });
  function setSortKey(k) {
    setSort(s => s.key === k ? { key: k, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key: k, dir: 'desc' });
  }

  // Counts
  const counts = { all: pv.positions.length, tradfi: 0, crypto: 0, fiat: 0 };
  pv.positions.forEach(p => counts[p.asset.class]++);

  // Recent transactions for this portfolio
  const txs = CURS_DATA.TX.filter(t => t.portfolio === portfolio.id).slice(0, 14);

  return (
    <div className="content">
      {/* Header */}
      <div className="page-head">
        <div>
          <div className="row gap-sm" style={{marginBottom: 8}}>
            <span style={{width: 12, height: 12, borderRadius: 3, background: portfolio.color}}></span>
            <span className="pill">{portfolio.positions.length}&nbsp;позиций</span>
          </div>
          <div className="title">{portfolio.name}</div>
        </div>
        <div className="right">
          <button className="btn" onClick={() => onAddAsset(portfolio)}>{CURS_UI.I.plus()}<span>Актив</span></button>
          <button className="btn primary" onClick={() => onAddTx(portfolio)}>{CURS_UI.I.plus()}<span>Сделка</span></button>
        </div>
      </div>

      {/* Compact value strip */}
      <div className="portfolio-strip">
        <div className="strip-item">
          <div className="mini">Стоимость</div>
          <div className="row" style={{gap: 10, alignItems: 'baseline', marginTop: 4}}>
            <span className="mono mask" style={{fontSize: 30, fontWeight: 600, letterSpacing:'-0.025em'}}>
              {CURS_CHARTS.fmtMoneyCompact(pv.total)}<span style={{fontSize: 15, color: 'var(--ink-3)'}}> ₽</span>
            </span>
            <CURS_UI.PercentDelta value={deltaPct} />
            <span className="mini" style={{marginLeft: 4}}>за 3М</span>
          </div>
        </div>
        <div className="strip-vh"></div>
        <div className="strip-item">
          <div className="mini">P&L (общий)</div>
          <div className={'mono mask ' + (pv.pl >= 0 ? 'delta up' : 'delta down')} style={{fontSize: 22, fontWeight: 600, marginTop: 4}}>
            {pv.pl >= 0 ? '+' : '−'}{CURS_CHARTS.fmtMoneyCompact(Math.abs(pv.pl))} ₽
          </div>
        </div>
        <div className="strip-vh"></div>
        <div className="strip-item">
          <div className="mini">Стоимость покупок</div>
          <div className="mono mask" style={{fontSize: 22, fontWeight: 600, marginTop: 4, color: 'var(--ink-2)'}}>
            {CURS_CHARTS.fmtMoneyCompact(pv.totalCost)} ₽
          </div>
        </div>
        <div className="strip-spark">
          <CURS_CHARTS.Sparkline series={series} width={220} height={48} positive={deltaPct >= 0} thickness={1.6} />
        </div>
      </div>

      {/* Positions */}
      <CURS_UI.SectionHeader title="Позиции" sub={`${filtered.length} из ${pv.positions.length}`} right={
        <div className="tabs">
          {[
            ['all', 'Все'],
            ['tradfi', 'Трад. финансы'],
            ['crypto', 'Крипта'],
            ['fiat', 'Валюты'],
          ].map(([k, l]) => (
            <div key={k} className={'tab ' + (classFilter === k ? 'active' : '')} onClick={() => setClassFilter(k)}>
              {l}<span className="muted" style={{marginLeft: 6, fontSize: 10}}>{counts[k]}</span>
            </div>
          ))}
        </div>
      } />

      <div className="card" style={{padding: 0, marginBottom: 28}}>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Актив</th>
                <th onClick={() => setSortKey('class')}>Класс {sort.key==='class' && <span className="arrow">{sort.dir==='desc'?'↓':'↑'}</span>}</th>
                <th className="num">Кол-во</th>
                <th className="num">Цена</th>
                <th className="num" onClick={() => setSortKey('value')}>Стоимость / доля {sort.key==='value' && <span className="arrow">{sort.dir==='desc'?'↓':'↑'}</span>}</th>
                <th className="num" onClick={() => setSortKey('pl')}>P&L {sort.key==='pl' && <span className="arrow">{sort.dir==='desc'?'↓':'↑'}</span>}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <PositionRow key={i} pos={p} total={pv.total} onClick={() => onOpenPosition && onOpenPosition(p)} />
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan="6" style={{padding: 28, textAlign: 'center', color: 'var(--ink-3)'}}>В этом классе пока нет позиций. <button className="btn sm" style={{marginLeft: 8}} onClick={() => onAddAsset(portfolio)}>Добавить</button></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transactions */}
      <CURS_UI.SectionHeader title="Сделки" sub={`${txs.length}`} right={
        <button className="btn sm" onClick={() => onAddTx(portfolio)}>{CURS_UI.I.plus()} Сделка</button>
      } />
      <div className="card" style={{padding: 0}}>
        {txs.length === 0 && <div style={{padding: 32, textAlign: 'center', color: 'var(--ink-3)'}}>Сделок пока нет</div>}
        <div className="tx-list">
          {txs.map(t => <TxRow key={t.id} tx={t} />)}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Position row
// ============================================
function PositionRow({ pos, total, onClick }) {
  const share = total > 0 ? pos.valBase / total : 0;
  const { asset } = pos;
  const isFiat = asset.class === 'fiat';
  return (
    <tr className="row" onClick={onClick}>
      <td>
        <div className="ticker">
          <CURS_UI.AssetIcon asset={asset} size={32} />
          <div className="meta">
            <div className="nm">{asset.id}</div>
            <div className="sub">{asset.name}{asset.sub ? ' · ' + asset.sub : ''}</div>
          </div>
        </div>
      </td>
      <td><CURS_UI.ClassChip cls={asset.class} small /></td>
      <td className="num">
        <div className="col" style={{gap: 0, alignItems: 'flex-end'}}>
          <span>{CURS_DATA.fmtQty(pos.qty)}</span>
          {!isFiat && <span className="mini">ср. {CURS_DATA.fmtCcy(pos.avgPrice, asset.ccy, { decimals: pos.avgPrice > 1000 ? 0 : 2 })}</span>}
        </div>
      </td>
      <td className="num">
        {isFiat
          ? (asset.id === 'RUB' ? '—' : CURS_DATA.fmtRUB(asset.price, { decimals: 2 }))
          : CURS_DATA.fmtCcy(asset.price, asset.ccy, { decimals: asset.price > 1000 ? 0 : 2 })}
      </td>
      <td className="num">
        <div className="col" style={{gap: 4, alignItems: 'flex-end'}}>
          <span className="mask">{CURS_CHARTS.fmtMoneyCompact(pos.valBase)} ₽</span>
          <div className="row gap-sm" style={{justifyContent: 'flex-end'}}>
            <div className="share-bar"><div style={{width: Math.min(100, share * 100 * 2) + '%'}}></div></div>
            <span className="mini" style={{fontFamily: 'var(--mono)'}}>{(share * 100).toFixed(1).replace('.', ',')}%</span>
          </div>
        </div>
      </td>
      <td className="num">
        {isFiat
          ? <span className="muted">—</span>
          : <CURS_UI.PercentDelta value={pos.plPct} />}
      </td>
    </tr>
  );
}

// ============================================
// Transaction row — used in dashboard & portfolio
// ============================================
function TxRow({ tx, showPortfolio }) {
  const meta = txMeta(tx.type);
  // Build display: title + amount
  let title, sub, valueEl;
  const portfolio = CURS_DATA.PORTFOLIOS.find(p => p.id === tx.portfolio);
  if (tx.type === 'in' || tx.type === 'out') {
    const a = CURS_DATA.asset(tx.asset);
    title = meta.label + ' ' + a.id;
    sub = CURS_DATA.fmtQty(tx.qty) + ' ' + a.id;
    valueEl = <span style={{color: meta.color}}>
      {tx.type === 'in' ? '+' : '−'}{CURS_DATA.fmtCcy(tx.qty, a.ccy, { decimals: a.ccy === 'RUB' ? 0 : 2 })}
    </span>;
  } else if (tx.type === 'div') {
    const cash = CURS_DATA.asset(tx.cashAsset);
    title = 'Дивиденд · ' + tx.source;
    sub = CURS_DATA.fmtCcy(tx.qty, cash.ccy, { decimals: cash.ccy === 'RUB' ? 0 : 2 }) + ' на счёт';
    valueEl = <span style={{color: meta.color}}>+{CURS_DATA.fmtCcy(tx.qty, cash.ccy, { decimals: cash.ccy === 'RUB' ? 0 : 2 })}</span>;
  } else if (tx.type === 'tx') {
    title = 'Транзакция · ' + tx.from.asset + ' → ' + tx.to.asset;
    const aFrom = CURS_DATA.asset(tx.from.asset);
    const aTo = CURS_DATA.asset(tx.to.asset);
    sub = CURS_DATA.fmtQty(tx.from.qty) + ' ' + tx.from.asset + ' → ' + CURS_DATA.fmtQty(tx.to.qty) + ' ' + tx.to.asset;
    valueEl = <span className="muted">
      <span style={{color: 'var(--down)'}}>−{CURS_DATA.fmtCcy(tx.from.qty, aFrom.ccy, { decimals: aFrom.ccy === 'RUB' ? 0 : 2 })}</span>
      {' / '}
      <span style={{color: 'var(--up)'}}>+{CURS_DATA.fmtQty(tx.to.qty)} {tx.to.asset}</span>
    </span>;
  }

  return (
    <div className="tx-row">
      <div className="tx-icon" style={{background: meta.bg, color: meta.color}}>{meta.icon}</div>
      <div className="col" style={{flex: 1, minWidth: 0, gap: 2}}>
        <div className="row gap-sm" style={{alignItems: 'baseline'}}>
          <span className="tx-title">{title}</span>
          {showPortfolio && portfolio && (
            <span className="pill ghost" style={{height: 18, fontSize: 10}}>
              <span className="dot" style={{background: portfolio.color}}></span>
              {portfolio.name}
            </span>
          )}
        </div>
        <span className="mini" style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{sub}</span>
      </div>
      <div className="col" style={{alignItems: 'flex-end', gap: 2}}>
        <span className="kvalue mask" style={{fontSize: 13}}>{valueEl}</span>
        <span className="mini">{fmtDateShort(tx.d)}</span>
      </div>
    </div>
  );
}

function txMeta(type) {
  return {
    in:  { label: 'Пополнение',  icon: CURS_UI.I.arrow_in(),  color: 'var(--up)',    bg: 'var(--up-soft)' },
    out: { label: 'Вывод',       icon: CURS_UI.I.arrow_out(), color: 'var(--down)',  bg: 'var(--down-soft)' },
    tx:  { label: 'Транзакция',  icon: CURS_UI.I.swap(),      color: 'var(--ink)',   bg: 'var(--surface-3)' },
    div: { label: 'Дивиденд',    icon: CURS_UI.I.coin(),      color: 'var(--warn)',  bg: 'var(--warn-soft)' },
  }[type] || { label: type, icon: '·', color: 'var(--ink)', bg: 'var(--surface-3)' };
}

function fmtDateShort(d) {
  const dt = new Date(d);
  const today = CURS_DATA.today;
  const diffDays = Math.round((today - dt) / 86400000);
  if (diffDays === 0) return 'сегодня';
  if (diffDays === 1) return 'вчера';
  if (diffDays < 7) return diffDays + ' дн назад';
  const months = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
  return dt.getDate() + ' ' + months[dt.getMonth()];
}

window.CURS_PORTFOLIO = { PortfolioScreen, TxRow, PositionRow, txMeta };
