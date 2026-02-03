// CURS Mobile — phone-first prototype using CURS_DATA
const { useState: mUseState, useMemo: mUseMemo } = React;

// ============================================
// Root
// ============================================
function MobileApp() {
  const [tab, setTab] = mUseState('home');
  const [pfId, setPfId] = mUseState(null); // null = list view; or specific id
  const [planForm, setPlanForm] = mUseState(false);
  const [txModal, setTxModal] = mUseState(false);

  const portfolios = CURS_DATA.PORTFOLIOS;

  return (
    <IOSDevice width={402} height={874} dark={false}>
      <div className="m-app">
        <div className="m-screen">
          {tab === 'home' && (pfId
            ? <PortfolioScreen portfolio={portfolios.find(p => p.id === pfId)} onBack={() => setPfId(null)} onAddTx={() => setTxModal(true)} />
            : <HomeScreen portfolios={portfolios} onOpenPf={setPfId} />
          )}
          {tab === 'plan'      && <PlanScreen portfolios={portfolios} onAdd={() => setPlanForm(true)} />}
          {tab === 'analytics' && <AnalyticsScreen portfolios={portfolios} />}
          {tab === 'settings'  && <SettingsScreen />}
        </div>

        <TabBar tab={tab} setTab={setTab} onPlus={() => setTxModal(true)} />

        {/* Modals */}
        {txModal && <AddTxSheet onClose={() => setTxModal(false)} portfolios={portfolios} />}
        {planForm && <PlanFormSheet onClose={() => setPlanForm(false)} portfolios={portfolios} />}
      </div>
    </IOSDevice>
  );
}

// ============================================
// Tab Bar
// ============================================
function TabBar({ tab, setTab, onPlus }) {
  const items = [
    { id: 'home',      label: 'Обзор',      icon: ic.home },
    { id: 'plan',      label: 'Планировщик', icon: ic.plan },
    { id: '__plus',    label: '',           icon: null },
    { id: 'analytics', label: 'Аналитика',  icon: ic.chart },
    { id: 'settings',  label: 'Настройки',  icon: ic.gear },
  ];
  return (
    <div className="m-tabbar">
      {items.map(it => {
        if (it.id === '__plus') {
          return (
            <button key="plus" className="m-tab-plus" onClick={onPlus}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            </button>
          );
        }
        return (
          <button key={it.id} className={'m-tab ' + (tab === it.id ? 'active' : '')} onClick={() => setTab(it.id)}>
            <span className="m-tab-ic">{it.icon}</span>
            <span className="m-tab-lb">{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ============================================
// HOME — overview
// ============================================
function HomeScreen({ portfolios, onOpenPf }) {
  const [privacy, setPrivacy] = mUseState(false);

  const agg = mUseMemo(() => {
    const total     = portfolios.reduce((s, p) => s + CURS_DATA.portfolioValue(p).total, 0);
    const totalCost = portfolios.reduce((s, p) => s + CURS_DATA.portfolioValue(p).totalCost, 0);
    const series = portfolios[0].series.map((p, i) => ({
      d: p.d, v: portfolios.reduce((s, pp) => s + pp.series[i].v, 0)
    }));
    const byClass = { tradfi: 0, crypto: 0, fiat: 0 };
    portfolios.forEach(p => CURS_DATA.portfolioValue(p).positions.forEach(pos => {
      byClass[pos.asset.class] += pos.valBase;
    }));
    return { total, totalCost, series, byClass, pl: total - totalCost };
  }, [portfolios]);

  const startY = agg.series[0].v;
  const yearPct = (agg.total - startY) / startY;

  return (
    <div className="m-scroll">
      <div className="m-greet">
        <div className="m-greet-row">
          <span style={{fontSize: 13, color: '#6B7280', fontWeight: 500}}>Добрый день, Максим</span>
          <button className="m-eye" onClick={() => setPrivacy(p => !p)}>
            {privacy ? CURS_UI.I.eye_off() : CURS_UI.I.eye()}
          </button>
        </div>
      </div>

      <div className="m-hero">
        <div className="m-hero-label">Все портфели</div>
        <div className={'m-hero-num ' + (privacy ? 'mask' : '')}>
          {privacy ? '•••••' : CURS_CHARTS.fmtMoneyCompact(agg.total)}
          <span className="m-hero-ccy"> ₽</span>
        </div>
        <div className="m-hero-delta">
          <span className={'m-delta ' + (yearPct >= 0 ? 'up' : 'down')}>
            {yearPct >= 0 ? '▲' : '▼'} {Math.abs(yearPct * 100).toFixed(2).replace('.', ',')}%
          </span>
          <span style={{color: '#6B7280', fontSize: 13}}>· год</span>
        </div>
        <div className="m-hero-spark">
          <CURS_CHARTS.Sparkline series={agg.series} width={340} height={48} positive={yearPct >= 0} thickness={1.6} />
        </div>
      </div>

      {/* Class strip */}
      <div className="m-classes">
        {[
          ['tradfi', 'Трад. финансы'],
          ['crypto', 'Крипта'],
          ['fiat',   'Валюта'],
        ].map(([k, label]) => {
          const v = agg.byClass[k] || 0;
          const pct = agg.total > 0 ? v / agg.total : 0;
          return (
            <div key={k} className="m-class">
              <div className="m-class-top">
                <span style={{width: 8, height: 8, borderRadius: 2, background: CURS_DATA.CLASS_COLOR[k]}}></span>
                <span style={{fontSize: 11, color: '#6B7280', fontWeight: 500}}>{label}</span>
              </div>
              <div className="m-class-val">{CURS_CHARTS.fmtMoneyCompact(v)} ₽</div>
              <div className="m-class-pct">{(pct * 100).toFixed(0)}%</div>
              <div className="m-bar"><div style={{width: pct * 100 + '%', background: CURS_DATA.CLASS_COLOR[k]}}></div></div>
            </div>
          );
        })}
      </div>

      <SectionTitle title="Портфели" right={<span style={{fontSize: 13, color: '#6B7280'}}>{portfolios.length}</span>} />
      <div className="m-pf-list">
        {portfolios.map(p => <PortfolioRow key={p.id} portfolio={p} onClick={() => onOpenPf(p.id)} />)}
      </div>

      <SectionTitle title="Последние сделки" />
      <div className="m-tx-list">
        {CURS_DATA.TX.slice(0, 5).map(t => <TxRow key={t.id} tx={t} />)}
      </div>
      <div style={{height: 30}}></div>
    </div>
  );
}

function PortfolioRow({ portfolio, onClick }) {
  const pv = CURS_DATA.portfolioValue(portfolio);
  const series = portfolio.series.slice(-90);
  const pct = (series[series.length-1].v - series[0].v) / series[0].v;
  return (
    <button className="m-pf-row" onClick={onClick}>
      <div className="m-pf-left">
        <span className="m-pf-dot" style={{background: portfolio.color}}></span>
        <div className="m-pf-meta">
          <span style={{fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em'}}>{portfolio.name}</span>
          <span style={{fontSize: 12, color: '#6B7280'}}>{portfolio.positions.length} позиций</span>
        </div>
      </div>
      <CURS_CHARTS.Sparkline series={series} width={70} height={22} positive={pct >= 0} thickness={1.3} />
      <div className="m-pf-right">
        <span style={{fontSize: 16, fontWeight: 600, fontFamily: 'var(--mono)', letterSpacing: '-0.02em'}}>{CURS_CHARTS.fmtMoneyCompact(pv.total)} ₽</span>
        <span className={'m-delta sm ' + (pct >= 0 ? 'up' : 'down')}>{pct >= 0 ? '+' : ''}{(pct*100).toFixed(1).replace('.', ',')}%</span>
      </div>
    </button>
  );
}

function TxRow({ tx, showPortfolio }) {
  const meta = txTypeMeta[tx.type];
  let title, sub, amount, tone;
  const pf = CURS_DATA.PORTFOLIOS.find(p => p.id === tx.portfolio);
  if (tx.type === 'in' || tx.type === 'out') {
    const a = CURS_DATA.asset(tx.asset);
    title = (tx.type === 'in' ? 'Пополнение ' : 'Вывод ') + a.id;
    sub = CURS_DATA.fmtQty(tx.qty) + ' ' + a.id;
    amount = (tx.type === 'in' ? '+' : '−') + CURS_DATA.fmtCcy(tx.qty, a.ccy, { decimals: 0 });
    tone = tx.type === 'in' ? 'up' : 'down';
  } else if (tx.type === 'div') {
    const cash = CURS_DATA.asset(tx.cashAsset);
    title = 'Дивиденд · ' + tx.source;
    sub = 'Выплата';
    amount = '+' + CURS_DATA.fmtCcy(tx.qty, cash.ccy, { decimals: 0 });
    tone = 'up';
  } else if (tx.type === 'tx') {
    title = tx.from.asset + ' → ' + tx.to.asset;
    sub = CURS_DATA.fmtQty(tx.from.qty) + ' → ' + CURS_DATA.fmtQty(tx.to.qty);
    const aF = CURS_DATA.asset(tx.from.asset);
    amount = '−' + CURS_DATA.fmtQty(tx.from.qty) + ' ' + aF.id;
    tone = '';
  }
  return (
    <div className="m-tx-row">
      <div className="m-tx-ic" style={{background: meta.bg, color: meta.color}}>{meta.glyph}</div>
      <div className="m-tx-meta">
        <span className="m-tx-title">{title}</span>
        <span className="m-tx-sub">{sub} {showPortfolio && pf && <span style={{marginLeft: 6, color: '#9CA3AF'}}>· {pf.name}</span>}</span>
      </div>
      <div className="m-tx-right">
        <span className={'m-tx-amt ' + tone}>{amount}</span>
        <span className="m-tx-date">{fmtDateShort(tx.d)}</span>
      </div>
    </div>
  );
}

// ============================================
// PORTFOLIO detail
// ============================================
function PortfolioScreen({ portfolio, onBack, onAddTx }) {
  const [filter, setFilter] = mUseState('all');
  const pv = CURS_DATA.portfolioValue(portfolio);
  const series = portfolio.series.slice(-90);
  const pct = (pv.total - series[0].v) / series[0].v;

  const positions = pv.positions
    .filter(p => filter === 'all' || p.asset.class === filter)
    .sort((a, b) => b.valBase - a.valBase);

  const txs = CURS_DATA.TX.filter(t => t.portfolio === portfolio.id).slice(0, 10);

  return (
    <div className="m-scroll">
      <div className="m-back-bar">
        <button className="m-back" onClick={onBack}>‹ Назад</button>
        <span style={{fontSize: 15, fontWeight: 600}}>{portfolio.name}</span>
        <span style={{width: 60}}></span>
      </div>

      <div className="m-pf-hero" style={{borderTop: `3px solid ${portfolio.color}`}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6}}>
          <span style={{width: 8, height: 8, borderRadius: 2, background: portfolio.color}}></span>
          <span style={{fontSize: 12, color: '#6B7280', fontWeight: 500}}>{portfolio.positions.length} позиций</span>
        </div>
        <div className="m-pf-val">{CURS_CHARTS.fmtMoneyCompact(pv.total)} <span style={{fontSize: 18, color: '#6B7280'}}>₽</span></div>
        <div className="m-hero-delta" style={{marginTop: 4}}>
          <span className={'m-delta ' + (pct >= 0 ? 'up' : 'down')}>
            {pct >= 0 ? '▲' : '▼'} {Math.abs(pct * 100).toFixed(2).replace('.', ',')}% · 3М
          </span>
          <span style={{color: '#6B7280', fontSize: 12}}>· P&L {pv.pl >= 0 ? '+' : '−'}{CURS_CHARTS.fmtMoneyCompact(Math.abs(pv.pl))} ₽</span>
        </div>
        <div style={{marginTop: 14}}>
          <CURS_CHARTS.Sparkline series={series} width={340} height={50} positive={pct >= 0} thickness={1.6} />
        </div>
      </div>

      <div className="m-filter">
        {[
          ['all', 'Все'],
          ['tradfi', 'Финансы'],
          ['crypto', 'Крипта'],
          ['fiat', 'Валюты'],
        ].map(([k, l]) => (
          <button key={k} className={'m-filter-pill ' + (filter === k ? 'active' : '')} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      <div className="m-pos-list">
        {positions.map((p, i) => <PositionRow key={i} pos={p} total={pv.total} />)}
        {positions.length === 0 && <div style={{padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 14}}>В этом классе пока нет позиций</div>}
      </div>

      <SectionTitle title="Сделки" />
      <div className="m-tx-list">
        {txs.map(t => <TxRow key={t.id} tx={t} />)}
        {txs.length === 0 && <div style={{padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 14}}>Сделок пока нет</div>}
      </div>
      <div style={{height: 40}}></div>
    </div>
  );
}

function PositionRow({ pos, total }) {
  const share = total > 0 ? pos.valBase / total : 0;
  const isFiat = pos.asset.class === 'fiat';
  return (
    <div className="m-pos-row">
      <CURS_UI.AssetIcon asset={pos.asset} size={36} />
      <div className="m-pos-meta">
        <span className="m-pos-id">{pos.asset.id}</span>
        <span className="m-pos-name">{pos.asset.name}</span>
      </div>
      <div className="m-pos-vals">
        <span className="m-pos-val">{CURS_CHARTS.fmtMoneyCompact(pos.valBase)} ₽</span>
        <div className="m-pos-meta-line">
          <span className="m-pos-share">{(share * 100).toFixed(1).replace('.', ',')}%</span>
          {!isFiat && (
            <span className={'m-delta sm ' + (pos.plPct >= 0 ? 'up' : 'down')}>
              {pos.plPct >= 0 ? '+' : ''}{(pos.plPct * 100).toFixed(1).replace('.', ',')}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// PLAN — list of planned transactions
// ============================================
function PlanScreen({ portfolios, onAdd }) {
  const [plans, setPlans] = mUseState([
    { id: 'pl1', type: 'buy',  portfolioId: 'main',   date: '2026-05-30', assetId: 'NVDA', qty: 25, price: 175, cashAsset: 'USD' },
    { id: 'pl2', type: 'sell', portfolioId: 'main',   date: '2026-06-15', assetId: 'YNDX', qty: 8,  price: 5200, cashAsset: 'RUB' },
    { id: 'pl3', type: 'in',   portfolioId: 'long',   date: '2026-06-01', asset: 'RUB', qty: 100000 },
  ]);

  const totals = mUseMemo(() => {
    let inflow = 0, outflow = 0;
    plans.forEach(p => {
      if (p.type === 'buy') {
        const a = CURS_DATA.asset(p.assetId);
        outflow += p.qty * p.price * CURS_DATA.rateToBase(a.ccy);
      } else if (p.type === 'sell') {
        const a = CURS_DATA.asset(p.assetId);
        inflow += p.qty * p.price * CURS_DATA.rateToBase(a.ccy);
      } else if (p.type === 'in') {
        const a = CURS_DATA.asset(p.asset);
        inflow += p.qty * CURS_DATA.rateToBase(a.ccy);
      } else if (p.type === 'out') {
        const a = CURS_DATA.asset(p.asset);
        outflow += p.qty * CURS_DATA.rateToBase(a.ccy);
      }
    });
    return { inflow, outflow, net: inflow - outflow };
  }, [plans]);

  return (
    <div className="m-scroll">
      <div className="m-page-head">
        <div>
          <h1 className="m-page-title">Планировщик</h1>
          <span className="m-page-sub">{plans.length} {planPlural(plans.length)} в плане</span>
        </div>
        <button className="m-btn primary sm" onClick={onAdd}>+ План</button>
      </div>

      <div className="m-plan-hero">
        <div className="m-plan-hero-row">
          <span className="m-hero-label" style={{marginBottom: 4}}>Чистый кэш-флоу</span>
          <span className={'m-plan-net ' + (totals.net > 0 ? 'up' : totals.net < 0 ? 'down' : '')}>
            {totals.net === 0 ? '0' : (totals.net > 0 ? '+' : '−') + CURS_CHARTS.fmtMoneyCompact(Math.abs(totals.net))}
            <span style={{fontSize: 16, color: '#9CA3AF', fontWeight: 500}}> ₽</span>
          </span>
        </div>
        <div className="m-plan-hero-flow">
          <div className="m-plan-flow-bar">
            <div style={{flex: totals.inflow, background: 'var(--up)'}}></div>
            <div style={{flex: totals.outflow, background: 'var(--down)'}}></div>
          </div>
          <div style={{display: 'flex', justifyContent: 'space-between', marginTop: 8}}>
            <span style={{fontSize: 12, color: 'var(--up)', fontWeight: 600}}>+{CURS_CHARTS.fmtMoneyCompact(totals.inflow)} ₽</span>
            <span style={{fontSize: 12, color: 'var(--down)', fontWeight: 600}}>−{CURS_CHARTS.fmtMoneyCompact(totals.outflow)} ₽</span>
          </div>
        </div>
      </div>

      <div className="m-plan-list">
        {plans.map(p => <PlanRow key={p.id} plan={p} portfolios={portfolios} onDelete={() => setPlans(ps => ps.filter(x => x.id !== p.id))} />)}
      </div>

      <button className="m-add-block" onClick={onAdd}>
        <span>＋</span>
        <span>Запланировать сделку</span>
      </button>
      <div style={{height: 30}}></div>
    </div>
  );
}

function PlanRow({ plan, portfolios, onDelete }) {
  const pf = portfolios.find(p => p.id === plan.portfolioId);
  const meta = planTypeMeta[plan.type];

  let title, sub, amount, tone;
  if (plan.type === 'buy') {
    const a = CURS_DATA.asset(plan.assetId);
    title = `Купить ${CURS_DATA.fmtQty(plan.qty)} ${a.id}`;
    sub = `по ${CURS_DATA.fmtCcy(plan.price, a.ccy, { decimals: plan.price > 1000 ? 0 : 2 })}`;
    amount = '−' + CURS_CHARTS.fmtMoneyCompact(plan.qty * plan.price * CURS_DATA.rateToBase(a.ccy));
    tone = 'down';
  } else if (plan.type === 'sell') {
    const a = CURS_DATA.asset(plan.assetId);
    title = `Продать ${CURS_DATA.fmtQty(plan.qty)} ${a.id}`;
    sub = `по ${CURS_DATA.fmtCcy(plan.price, a.ccy, { decimals: plan.price > 1000 ? 0 : 2 })}`;
    amount = '+' + CURS_CHARTS.fmtMoneyCompact(plan.qty * plan.price * CURS_DATA.rateToBase(a.ccy));
    tone = 'up';
  } else if (plan.type === 'in') {
    const a = CURS_DATA.asset(plan.asset);
    title = `Пополнение ${a.id}`;
    sub = CURS_DATA.fmtQty(plan.qty) + ' ' + a.id;
    amount = '+' + CURS_CHARTS.fmtMoneyCompact(plan.qty * CURS_DATA.rateToBase(a.ccy));
    tone = 'up';
  }

  return (
    <div className="m-plan-card">
      <div className="m-plan-top">
        <div className="m-plan-ic" style={{background: meta.bg, color: meta.color}}>{meta.icon}</div>
        <div className="m-plan-meta">
          <span className="m-plan-title">{title}</span>
          <span className="m-plan-sub">{sub}</span>
        </div>
        <div className="m-plan-amt-col">
          <span className={'m-plan-amt ' + tone}>{amount}<span style={{fontSize: 12, color: '#9CA3AF', fontWeight: 500}}> ₽</span></span>
          <span className="m-plan-date">{fmtDateShort(plan.date)}</span>
        </div>
      </div>
      <div className="m-plan-bottom">
        <div className="m-plan-pf">
          {pf && (<>
            <span style={{width: 7, height: 7, borderRadius: 2, background: pf.color}}></span>
            <span>{pf.name}</span>
          </>)}
        </div>
        <div style={{display: 'flex', gap: 8}}>
          <button className="m-plan-act" onClick={onDelete}>Удалить</button>
          <button className="m-plan-act primary">Записать</button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// ANALYTICS
// ============================================
function AnalyticsScreen({ portfolios }) {
  const [pfId, setPfId] = mUseState(portfolios[0].id);
  const [range, setRange] = mUseState('1Г');

  const portfolio = portfolios.find(p => p.id === pfId);
  const days = ({ '1М': 31, '3М': 92, '1Г': 365 })[range];
  const series = portfolio.series.slice(-days);
  const pct = (series[series.length - 1].v - series[0].v) / series[0].v;
  const pv = CURS_DATA.portfolioValue(portfolio);

  const tmItems = pv.positions.slice().sort((a, b) => b.valBase - a.valBase).slice(0, 8).map((p, i) => ({
    label: p.asset.id,
    value: p.valBase,
    share: (p.valBase / pv.total * 100).toFixed(1) + '%',
    color: ['#15140F','#2F4858','#86B0A0','#D7E041','#EE7544','#4F6BED','#B58300','#8C5BD7'][i],
  }));

  return (
    <div className="m-scroll">
      <div className="m-page-head">
        <h1 className="m-page-title">Аналитика</h1>
      </div>

      <div className="m-pf-tabs">
        {portfolios.map(p => (
          <button key={p.id} className={'m-pf-tab ' + (pfId === p.id ? 'active' : '')} onClick={() => setPfId(p.id)}>
            <span style={{width: 7, height: 7, borderRadius: 2, background: p.color, marginRight: 6}}></span>
            {p.name}
          </button>
        ))}
      </div>

      <div className="m-card">
        <div className="m-card-head">
          <div>
            <div className="m-card-label">Стоимость</div>
            <div className="m-card-val">{CURS_CHARTS.fmtMoneyCompact(pv.total)} <span style={{fontSize: 14, color: '#9CA3AF'}}>₽</span></div>
            <span className={'m-delta ' + (pct >= 0 ? 'up' : 'down')} style={{fontSize: 12}}>
              {pct >= 0 ? '+' : ''}{(pct * 100).toFixed(2).replace('.', ',')}% · {range}
            </span>
          </div>
          <div className="m-range-pills">
            {['1М', '3М', '1Г'].map(r => (
              <button key={r} className={'m-range-pill ' + (range === r ? 'active' : '')} onClick={() => setRange(r)}>{r}</button>
            ))}
          </div>
        </div>
        <CURS_CHARTS.LineAreaChart series={series} height={170} color="#15140F" areaFrom="rgba(21,20,15,.10)" areaTo="rgba(21,20,15,0)" />
      </div>

      <div className="m-kpi-grid">
        <Kpi label="CAGR" value={(portfolio.metrics.annRet * 100).toFixed(1).replace('.', ',') + '%'} tone={portfolio.metrics.annRet > 0 ? 'up' : 'down'} />
        <Kpi label="Sharpe" value={portfolio.metrics.sharpe.toFixed(2)} />
        <Kpi label="Volatility" value={(portfolio.metrics.vol * 100).toFixed(1).replace('.', ',') + '%'} />
        <Kpi label="Max DD" value={(portfolio.metrics.maxDD * 100).toFixed(1).replace('.', ',') + '%'} tone="down" />
      </div>

      <div className="m-card">
        <div className="m-card-label">Структура</div>
        <div style={{marginTop: 8}}>
          <CURS_CHARTS.Treemap items={tmItems} height={220} />
        </div>
      </div>

      <button className="m-add-block ghost">
        <span style={{fontSize: 18}}>＋</span>
        <span>Добавить виджет</span>
      </button>
      <div style={{height: 30}}></div>
    </div>
  );
}

function Kpi({ label, value, tone }) {
  return (
    <div className="m-kpi">
      <span className="m-kpi-lb">{label}</span>
      <span className={'m-kpi-val ' + (tone || '')}>{value}</span>
    </div>
  );
}

// ============================================
// SETTINGS
// ============================================
function SettingsScreen() {
  const [moex, setMoex] = mUseState(true);
  const [cg, setCg] = mUseState(false);

  return (
    <div className="m-scroll">
      <div className="m-page-head">
        <h1 className="m-page-title">Настройки</h1>
      </div>

      <div className="m-profile">
        <div className="m-ava">МР</div>
        <div style={{flex: 1, minWidth: 0}}>
          <div style={{fontSize: 16, fontWeight: 600}}>Максим Родиков</div>
          <div style={{fontSize: 13, color: '#6B7280'}}>maxim@curs.local</div>
        </div>
      </div>

      <div className="m-section-lb">Безопасность</div>
      <div className="m-list">
        <button className="m-list-item">
          <span className="m-list-ic" style={{background: '#15140F', color: '#fff'}}>🔒</span>
          <div className="m-list-meta">
            <span>Сменить пароль</span>
            <span className="mini">Последняя смена · 14 марта</span>
          </div>
          <span className="m-list-chev">›</span>
        </button>
      </div>

      <div className="m-section-lb">Источники цен</div>
      <div className="m-list">
        <div className="m-list-item">
          <span className="m-list-ic" style={{background: '#0072CE', color: '#fff'}}>M</span>
          <div className="m-list-meta">
            <span>Московская биржа</span>
            <span className="mini">Акции, облигации, ETF</span>
          </div>
          <Toggle on={moex} onChange={setMoex} />
        </div>
        <div className="m-list-item">
          <span className="m-list-ic" style={{background: '#8DC647', color: '#15140F'}}>C</span>
          <div className="m-list-meta">
            <span>CoinGecko</span>
            <span className="mini">Крипта · BTC, ETH, 10 000+ токенов</span>
          </div>
          <Toggle on={cg} onChange={setCg} />
        </div>
      </div>

      <div className="m-section-lb">Оформление</div>
      <div className="m-list">
        <div className="m-list-item">
          <span className="m-list-ic" style={{background: '#1F8F6F', color: '#fff'}}>◐</span>
          <div className="m-list-meta">
            <span>Тёмная тема</span>
            <span className="mini">Авто</span>
          </div>
          <span className="m-list-chev">›</span>
        </div>
        <div className="m-list-item">
          <span className="m-list-ic" style={{background: '#EE7544', color: '#fff'}}>👁</span>
          <div className="m-list-meta">
            <span>Privacy режим</span>
            <span className="mini">Скрывать суммы по умолчанию</span>
          </div>
          <Toggle on={false} onChange={() => {}} />
        </div>
      </div>

      <div className="m-section-lb">О приложении</div>
      <div className="m-list">
        <button className="m-list-item">
          <div className="m-list-meta" style={{paddingLeft: 4}}>
            <span>Помощь и поддержка</span>
          </div>
          <span className="m-list-chev">›</span>
        </button>
        <button className="m-list-item">
          <div className="m-list-meta" style={{paddingLeft: 4}}>
            <span>Версия</span>
          </div>
          <span style={{fontSize: 13, color: '#9CA3AF'}}>2.4.1</span>
        </button>
      </div>

      <button className="m-logout">Выйти</button>
      <div style={{height: 30}}></div>
    </div>
  );
}

function Toggle({ on, onChange }) {
  return (
    <button className={'m-toggle ' + (on ? 'on' : '')} onClick={() => onChange(!on)}>
      <span className="m-toggle-thumb"></span>
    </button>
  );
}

// ============================================
// SHEETS (modal bottom sheets)
// ============================================
function AddTxSheet({ onClose, portfolios }) {
  const [type, setType] = mUseState('buy');
  return (
    <Sheet onClose={onClose} title="Новая сделка">
      <div className="m-seg">
        {[['buy', 'Покупка'], ['sell', 'Продажа'], ['in', 'Пополнение'], ['out', 'Вывод'], ['tx', 'Транзакция'], ['div', 'Дивиденд']].map(([k, l]) => (
          <button key={k} className={'m-seg-btn ' + (type === k ? 'active' : '')} onClick={() => setType(k)}>{l}</button>
        ))}
      </div>

      <SheetField label="Портфель">
        <select className="m-inp">
          {portfolios.map(p => <option key={p.id}>{p.name}</option>)}
        </select>
      </SheetField>

      {(type === 'buy' || type === 'sell') && (
        <>
          <SheetField label={type === 'buy' ? 'Что покупаем' : 'Что продаём'}>
            <select className="m-inp"><option>SBER · Сбербанк</option><option>YNDX · Яндекс</option><option>BTC · Bitcoin</option></select>
          </SheetField>
          <div className="m-grid-2">
            <SheetField label="Количество"><input className="m-inp" type="number" placeholder="0" /></SheetField>
            <SheetField label="Цена"><input className="m-inp" type="number" placeholder="0,00" /></SheetField>
          </div>
        </>
      )}
      {(type === 'in' || type === 'out') && (
        <SheetField label={type === 'in' ? 'Вносится' : 'Снимается'}>
          <div className="m-grid-2">
            <select className="m-inp"><option>RUB</option><option>USD</option><option>EUR</option></select>
            <input className="m-inp" type="number" placeholder="0" />
          </div>
        </SheetField>
      )}

      <SheetField label="Дата">
        <input className="m-inp" type="date" defaultValue="2026-05-24" />
      </SheetField>

      <button className="m-btn primary lg" onClick={onClose}>Добавить</button>
    </Sheet>
  );
}

function PlanFormSheet({ onClose, portfolios }) {
  return (
    <Sheet onClose={onClose} title="Новый план">
      <div style={{padding: 14, background: '#F4F6F8', borderRadius: 12, fontSize: 13, color: '#6B7280', marginBottom: 14}}>
        Запланируйте сделку — потом одной кнопкой превратите её в реальную запись.
      </div>
      <div className="m-seg">
        {[['buy', 'Покупка'], ['sell', 'Продажа'], ['in', 'Пополнение'], ['out', 'Вывод']].map(([k, l]) => (
          <button key={k} className={'m-seg-btn ' + (k === 'buy' ? 'active' : '')}>{l}</button>
        ))}
      </div>
      <SheetField label="Актив">
        <select className="m-inp"><option>NVDA · NVIDIA</option></select>
      </SheetField>
      <div className="m-grid-2">
        <SheetField label="Количество"><input className="m-inp" type="number" defaultValue="25" /></SheetField>
        <SheetField label="Цена"><input className="m-inp" type="number" defaultValue="175" /></SheetField>
      </div>
      <SheetField label="Когда">
        <input className="m-inp" type="date" defaultValue="2026-05-30" />
      </SheetField>
      <button className="m-btn primary lg" onClick={onClose}>В план</button>
    </Sheet>
  );
}

function Sheet({ onClose, title, children }) {
  return (
    <div className="m-sheet-back" onClick={onClose}>
      <div className="m-sheet" onClick={e => e.stopPropagation()}>
        <div className="m-sheet-grab"></div>
        <div className="m-sheet-head">
          <span style={{fontSize: 17, fontWeight: 600}}>{title}</span>
          <button className="m-sheet-x" onClick={onClose}>✕</button>
        </div>
        <div className="m-sheet-body">{children}</div>
      </div>
    </div>
  );
}

function SheetField({ label, children }) {
  return (
    <div style={{marginBottom: 14}}>
      <div style={{fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500, marginBottom: 6}}>{label}</div>
      {children}
    </div>
  );
}

// ============================================
// Bits
// ============================================
function SectionTitle({ title, right }) {
  return (
    <div className="m-section-title">
      <span>{title}</span>
      {right}
    </div>
  );
}

const ic = {
  home:  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-6h-6v6H5a2 2 0 0 1-2-2z"/></svg>,
  plan:  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h3"/></svg>,
  chart: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 14l4-4 4 3 5-7"/></svg>,
  gear:  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.86l.06.07a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.07a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.07a1.7 1.7 0 0 0 1.55-1.11"/></svg>,
};

const txTypeMeta = {
  in:  { glyph: '+',  bg: 'rgba(47,125,67,.10)',  color: 'var(--up)' },
  out: { glyph: '−',  bg: 'rgba(192,57,43,.10)',  color: 'var(--down)' },
  tx:  { glyph: '⇄',  bg: 'rgba(60,60,60,.08)',  color: '#15140F' },
  div: { glyph: '◆',  bg: 'rgba(181,131,0,.10)',  color: '#B58300' },
};
const planTypeMeta = {
  buy:  { icon: '↑', bg: 'rgba(47,125,67,.10)', color: 'var(--up)' },
  sell: { icon: '↓', bg: 'rgba(192,57,43,.10)', color: 'var(--down)' },
  tx:   { icon: '⇄', bg: 'rgba(60,60,60,.08)', color: '#15140F' },
  in:   { icon: '+', bg: 'rgba(47,125,67,.10)', color: 'var(--up)' },
  out:  { icon: '−', bg: 'rgba(192,57,43,.10)', color: 'var(--down)' },
  div:  { icon: '◆', bg: 'rgba(181,131,0,.10)', color: '#B58300' },
};

function planPlural(n) {
  if (n % 10 === 1 && n % 100 !== 11) return 'сделка';
  if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return 'сделки';
  return 'сделок';
}
function fmtDateShort(d) {
  const dt = typeof d === 'string' ? new Date(d) : new Date(d);
  const months = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
  return dt.getDate() + ' ' + months[dt.getMonth()];
}

ReactDOM.createRoot(document.getElementById('root')).render(<MobileApp />);
