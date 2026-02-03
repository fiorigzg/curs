// CURS — Dashboard (Обзор) — максимально просто
const { useMemo: dsUseMemo } = React;

function Dashboard({ portfolios, setRoute, setActivePortfolio, onOpenAddTx }) {
  const [txLimit, setTxLimit] = React.useState(6);
  const { fmtRUB, CLASS_LABEL, CLASS_COLOR } = CURS_DATA;
  const { fmtMoneyCompact, Sparkline } = CURS_CHARTS;

  // Aggregate
  const agg = dsUseMemo(() => {
    const total = portfolios.reduce((s, p) => s + CURS_DATA.portfolioValue(p).total, 0);
    const totalCost = portfolios.reduce((s, p) => s + CURS_DATA.portfolioValue(p).totalCost, 0);
    // breakdown by asset class
    const byClass = { tradfi: 0, crypto: 0, fiat: 0 };
    portfolios.forEach(p => {
      CURS_DATA.portfolioValue(p).positions.forEach(pos => {
        byClass[pos.asset.class] = (byClass[pos.asset.class] || 0) + pos.valBase;
      });
    });
    // 1Y change of aggregate
    const series = portfolios[0].series.map((p, i) => ({
      d: p.d,
      v: portfolios.reduce((s, pp) => s + pp.series[i].v, 0)
    }));
    return { total, totalCost, byClass, series };
  }, [portfolios]);

  const startY = agg.series[0].v;
  const yearPct = (agg.total - startY) / startY;
  const totalPl = agg.total - agg.totalCost;
  const totalPlPct = agg.totalCost > 0 ? totalPl / agg.totalCost : 0;

  return (
    <div className="content overview">
      {/* Hero — one big number */}
      <div className="overview-hero">
        <div className="mini" style={{textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14}}>Всего по всем портфелям</div>
        <div className="row" style={{gap: 16, alignItems: 'baseline', flexWrap: 'wrap'}}>
          <h1 className="hero-num mask">{fmtMoneyCompact(agg.total)}</h1>
          <span className="hero-ccy">₽</span>
          <CURS_UI.PercentDelta value={totalPlPct} abs={totalPl} />
        </div>
        <div className="hero-spark">
          <Sparkline series={agg.series} width={680} height={64} positive={yearPct >= 0} thickness={1.6} />
          <div className="row between" style={{marginTop: 6, fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--mono)'}}>
            <span>год назад · {CURS_CHARTS.fmtMoneyCompact(startY)} ₽</span>
            <span>сейчас</span>
          </div>
        </div>
      </div>

      {/* Class strip */}
      <div className="class-strip">
        {['tradfi', 'crypto', 'fiat'].map(cls => {
          const v = agg.byClass[cls] || 0;
          const pct = agg.total > 0 ? v / agg.total : 0;
          return (
            <div key={cls} className="class-strip-item">
              <div className="row gap-sm" style={{marginBottom: 6}}>
                <span style={{width: 8, height: 8, borderRadius: 2, background: CLASS_COLOR[cls]}}></span>
                <span style={{fontSize: 12, color: 'var(--ink-2)', fontWeight: 500}}>{CLASS_LABEL[cls]}</span>
              </div>
              <div className="row" style={{gap: 8, alignItems: 'baseline'}}>
                <span className="mono mask" style={{fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em'}}>{fmtMoneyCompact(v)}<span style={{fontSize: 13, color:'var(--ink-3)'}}> ₽</span></span>
                <span className="mini">{(pct * 100).toFixed(0)}%</span>
              </div>
              <div className="bar-track" style={{marginTop: 8}}>
                <div className="fill" style={{width: (pct * 100) + '%', background: CLASS_COLOR[cls]}}></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Portfolios list */}
      <div className="row between" style={{marginTop: 36, marginBottom: 14, alignItems: 'baseline'}}>
        <div className="section-title lg">Портфели</div>
        <button className="btn ghost sm" onClick={() => setRoute('analytics')}>Перейти в аналитику {CURS_UI.I.arrow_right()}</button>
      </div>
      <div className="portfolios-grid">
        {portfolios.map(p => (
          <PortfolioCard key={p.id} portfolio={p}
            onClick={() => { setActivePortfolio(p.id); setRoute('portfolio'); }} />
        ))}
        <button className="portfolio-card portfolio-card-add" onClick={() => {/* TODO add portfolio */}}>
          <span style={{width: 36, height: 36, borderRadius: 10, background: 'var(--surface-3)', display: 'grid', placeItems: 'center'}}>{CURS_UI.I.plus()}</span>
          <span style={{marginTop: 12, fontSize: 14, fontWeight: 500, color: 'var(--ink-2)'}}>Новый портфель</span>
        </button>
      </div>

      {/* Recent transactions — short */}
      <div className="row between" style={{marginTop: 36, marginBottom: 14, alignItems: 'baseline'}}>
        <div className="section-title lg">Последние сделки</div>
        <button className="btn ghost sm" onClick={onOpenAddTx}>{CURS_UI.I.plus()} Добавить</button>
      </div>
      <div className="recent-tx">
        {CURS_DATA.TX.slice(0, txLimit).map(t => (
          <CURS_PORTFOLIO.TxRow key={t.id} tx={t} showPortfolio />
        ))}
        {txLimit < CURS_DATA.TX.length && (
          <button className="tx-load-more" onClick={() => setTxLimit(n => n + 6)}>
            <span>Показать ещё</span>
            <span className="mini" style={{fontFamily: 'var(--mono)'}}>
              · {Math.min(6, CURS_DATA.TX.length - txLimit)} из {CURS_DATA.TX.length - txLimit}
            </span>
          </button>
        )}
        {txLimit >= CURS_DATA.TX.length && txLimit > 6 && (
          <button className="tx-load-more muted" onClick={() => setTxLimit(6)}>
            Свернуть
          </button>
        )}
      </div>
    </div>
  );
}

function PortfolioCard({ portfolio, onClick }) {
  const pv = CURS_DATA.portfolioValue(portfolio);
  const series = portfolio.series.slice(-90);
  const start = series[0].v, end = series[series.length - 1].v;
  const pct = (end - start) / start;

  return (
    <button className="portfolio-card" onClick={onClick}>
      <div className="row between" style={{marginBottom: 18, alignItems: 'flex-start'}}>
        <div className="row gap-sm">
          <span style={{width: 10, height: 10, borderRadius: 3, background: portfolio.color, marginTop: 5}}></span>
          <div className="col" style={{gap: 2}}>
            <span style={{fontWeight: 600, fontSize: 15, letterSpacing: '-0.01em'}}>{portfolio.name}</span>
            <span className="mini">{portfolio.positions.length}&nbsp;позиций</span>
          </div>
        </div>
        <CURS_CHARTS.Sparkline series={series} width={100} height={28} positive={pct >= 0} thickness={1.4} />
      </div>
      <div className="col" style={{gap: 4}}>
        <span className="mono mask" style={{fontSize: 26, fontWeight: 600, letterSpacing: '-0.025em'}}>
          {CURS_CHARTS.fmtMoneyCompact(pv.total)}&nbsp;<span style={{fontSize: 14, color: 'var(--ink-3)'}}>₽</span>
        </span>
        <CURS_UI.PercentDelta value={pct} />
      </div>
    </button>
  );
}

window.CURS_DASHBOARD = { Dashboard };
