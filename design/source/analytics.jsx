// CURS — Analytics: один кастомизируемый дашборд из виджетов
const { useState: anUseState, useMemo: anUseMemo, useEffect: anUseEffect } = React;

const STORAGE_KEY = 'curs.analytics.widgets';

// Default set of widgets on first load
const DEFAULT_LAYOUT = [
  'kpi-value', 'kpi-pl', 'kpi-sharpe', 'kpi-maxdd',
  'equity',
  'structure', 'classes',
  'drawdown',
];

function AnalyticsScreen({ portfolio, allPortfolios, setActivePortfolio }) {
  const [range, setRange] = anUseState('1Г');
  const [edit, setEdit] = anUseState(false);
  const [galleryOpen, setGalleryOpen] = anUseState(false);

  // Layout — array of widget ids
  const [layout, setLayout] = anUseState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return DEFAULT_LAYOUT;
  });
  anUseEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(layout)); } catch (e) {}
  }, [layout]);

  function addWidget(id) {
    if (!layout.includes(id)) setLayout(l => [...l, id]);
  }
  function removeWidget(id) {
    setLayout(l => l.filter(x => x !== id));
  }
  function moveWidget(id, dir) {
    setLayout(l => {
      const i = l.indexOf(id); if (i < 0) return l;
      const j = i + dir; if (j < 0 || j >= l.length) return l;
      const next = l.slice(); [next[i], next[j]] = [next[j], next[i]]; return next;
    });
  }
  function resetLayout() { setLayout(DEFAULT_LAYOUT); }

  const ctx = { portfolio, range };

  return (
    <div className="content wide">
      <div className="page-head">
        <div>
          <div className="title">Аналитика</div>
          <div className="sub">{portfolio.name} · {layout.length} {pluralWidgets(layout.length)}</div>
        </div>
        <div className="right">
          <select className="btn" style={{padding: '0 10px'}} value={portfolio.id} onChange={e => setActivePortfolio(e.target.value)}>
            {allPortfolios.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <CURS_UI.RangeTabs value={range} onChange={setRange} />
          <button className={'btn ' + (edit ? 'primary' : '')} onClick={() => setEdit(e => !e)}>
            {edit ? 'Готово' : 'Редактировать'}
          </button>
          <button className="btn" onClick={() => setGalleryOpen(true)}>{CURS_UI.I.plus()}<span>Виджет</span></button>
        </div>
      </div>

      <div className={'widgets-grid ' + (edit ? 'editing' : '')}>
        {layout.map(id => {
          const def = WIDGETS[id];
          if (!def) return null;
          return (
            <Widget key={id} def={def} ctx={ctx}
              edit={edit}
              onRemove={() => removeWidget(id)}
              onMoveLeft={() => moveWidget(id, -1)}
              onMoveRight={() => moveWidget(id, +1)} />
          );
        })}
        {edit && (
          <button className="widget widget-add" onClick={() => setGalleryOpen(true)} style={{gridColumn: 'span 2'}}>
            <span style={{width: 40, height: 40, borderRadius: 10, background: 'var(--surface-3)', display:'grid', placeItems:'center', marginBottom: 12}}>{CURS_UI.I.plus()}</span>
            <span style={{fontWeight: 600}}>Добавить виджет</span>
            <span className="mini" style={{marginTop: 4}}>Из библиотеки сообщества</span>
          </button>
        )}
      </div>

      {edit && (
        <div className="edit-bar">
          <span className="mini">Режим редактирования. Виджеты можно удалять и переупорядочивать.</span>
          <button className="btn sm" onClick={resetLayout}>Сбросить</button>
          <button className="btn sm primary" onClick={() => setEdit(false)}>Готово</button>
        </div>
      )}

      <WidgetGallery
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        activeIds={layout}
        onAdd={addWidget}
        onRemove={removeWidget}
      />
    </div>
  );
}

function pluralWidgets(n) {
  if (n % 10 === 1 && n % 100 !== 11) return 'виджет';
  if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return 'виджета';
  return 'виджетов';
}

// ============================================
// Widget wrapper
// ============================================
function Widget({ def, ctx, edit, onRemove, onMoveLeft, onMoveRight }) {
  return (
    <div className="widget" data-size={def.size}>
      {edit && (
        <div className="widget-controls">
          <button className="widget-ctrl" onClick={onMoveLeft} title="Влево">‹</button>
          <button className="widget-ctrl" onClick={onMoveRight} title="Вправо">›</button>
          <button className="widget-ctrl danger" onClick={onRemove} title="Удалить">{CURS_UI.I.close()}</button>
        </div>
      )}
      {def.render(ctx)}
    </div>
  );
}

// ============================================
// Widget Gallery modal
// ============================================
function WidgetGallery({ open, onClose, activeIds, onAdd, onRemove }) {
  const [tab, setTab] = anUseState('all');
  const all = Object.entries(WIDGETS).map(([id, def]) => ({ id, ...def }));
  const visible = all.filter(w => tab === 'all' ? true : tab === 'official' ? w.official : !w.official);

  return (
    <CURS_UI.Modal open={open} onClose={onClose}
      title="Библиотека виджетов"
      sub="Дашборд собирается из официальных блоков и виджетов от сообщества"
      width={780}
      footer={
        <>
          <span className="mini" style={{marginRight: 'auto'}}>{activeIds.length} установлено · {all.length - activeIds.length} доступно</span>
          <button className="btn primary" onClick={onClose}>Готово</button>
        </>
      }
    >
      <div className="tabs" style={{alignSelf: 'flex-start'}}>
        {[['all','Все'],['official','Официальные'],['community','Сообщество']].map(([k,l]) => (
          <div key={k} className={'tab ' + (tab===k?'active':'')} onClick={() => setTab(k)}>{l}</div>
        ))}
      </div>

      <div className="gallery-grid">
        {visible.map(w => {
          const active = activeIds.includes(w.id);
          return (
            <div key={w.id} className={'gallery-card ' + (active ? 'active' : '')}>
              <div className="gallery-icon" style={{background: w.color || 'var(--surface-3)'}}>
                {w.glyph || '◆'}
              </div>
              <div className="col" style={{flex: 1, gap: 4, minWidth: 0}}>
                <div className="row gap-sm" style={{alignItems: 'baseline'}}>
                  <span style={{fontSize: 14, fontWeight: 600}}>{w.title}</span>
                  {w.official
                    ? <span className="pill" style={{height: 18, fontSize: 10}}>офиц.</span>
                    : <span className="mini" style={{fontFamily: 'var(--mono)'}}>{w.author}</span>}
                </div>
                <div className="mini" style={{lineHeight: 1.45}}>{w.sub}</div>
                <div className="row gap-sm mini" style={{marginTop: 4}}>
                  <span style={{fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.05em'}}>{w.size}</span>
                  {w.installs && <span>· {w.installs} установок</span>}
                </div>
              </div>
              <button className={'btn sm ' + (active ? '' : 'primary')}
                onClick={() => active ? onRemove(w.id) : onAdd(w.id)}>
                {active ? 'Убрать' : '+ Добавить'}
              </button>
            </div>
          );
        })}
      </div>
    </CURS_UI.Modal>
  );
}

// ============================================
// Helpers shared by widgets
// ============================================
function KpiCard({ label, value, delta, sub, tone }) {
  return (
    <div className="card kpi">
      <div className="mini" style={{textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8}}>{label}</div>
      <div className="mono mask" style={{fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', color: tone === 'up' ? 'var(--up)' : tone === 'down' ? 'var(--down)' : 'var(--ink)'}}>{value}</div>
      <div className="row between" style={{marginTop: 6}}>
        <span className="mini">{sub}</span>
        {delta != null && <CURS_UI.PercentDelta value={delta} />}
      </div>
    </div>
  );
}

function getValueCtx(portfolio, range) {
  const days = CURS_UI.RANGE_DAYS[range];
  const series = portfolio.series.slice(-days);
  const startV = series[0].v, endV = series[series.length - 1].v;
  return { series, startV, endV, rangeDelta: endV - startV, rangeDeltaPct: (endV - startV) / startV };
}

// ============================================
// WIDGET DEFINITIONS
// ============================================
const WIDGETS = {
  // ---- KPI tiles ----
  'kpi-value': {
    title: 'Стоимость портфеля', sub: 'Текущая суммарная стоимость и изменение за период.',
    size: 'xs', official: true, glyph: '₽', color: 'var(--ink)',
    render: ({ portfolio, range }) => {
      const { rangeDeltaPct } = getValueCtx(portfolio, range);
      const pv = CURS_DATA.portfolioValue(portfolio);
      return <KpiCard label="Стоимость" value={CURS_DATA.fmtRUB(pv.total, { compact: true })} delta={rangeDeltaPct} sub={`за ${range}`} />;
    }
  },
  'kpi-pl': {
    title: 'P&L всего', sub: 'Нереализованная прибыль/убыток с момента покупок.',
    size: 'xs', official: true, glyph: '±', color: 'var(--up)',
    render: ({ portfolio }) => {
      const pv = CURS_DATA.portfolioValue(portfolio);
      return <KpiCard label="P&L всего" value={CURS_DATA.fmtRUB(pv.pl, { compact: true, sign: true })} delta={pv.plPct} tone={pv.pl >= 0 ? 'up' : 'down'} />;
    }
  },
  'kpi-sharpe': {
    title: 'Sharpe Ratio', sub: 'Доходность относительно безрисковой ставки, делённая на риск.',
    size: 'xs', official: true, glyph: 'S', color: '#4F6BED',
    render: ({ portfolio }) => <KpiCard label="Sharpe" value={portfolio.metrics.sharpe.toFixed(2)} sub="(R−7%)/σ" />
  },
  'kpi-maxdd': {
    title: 'Max Drawdown', sub: 'Наибольшая просадка от пика за период.',
    size: 'xs', official: true, glyph: '↓', color: 'var(--down)',
    render: ({ portfolio }) => <KpiCard label="Max DD" value={(portfolio.metrics.maxDD * 100).toFixed(1).replace('.', ',') + '%'} sub="за период" tone="down" />
  },
  'kpi-cagr': {
    title: 'CAGR', sub: 'Среднегодовая доходность портфеля.',
    size: 'xs', official: true, glyph: '∡', color: '#1F8F6F',
    render: ({ portfolio }) => <KpiCard label="CAGR" value={(portfolio.metrics.annRet * 100).toFixed(1).replace('.', ',') + '%'} sub="годовая" tone={portfolio.metrics.annRet > 0 ? 'up' : 'down'} />
  },
  'kpi-vol': {
    title: 'Волатильность', sub: 'Годовое стандартное отклонение доходности.',
    size: 'xs', author: '@quant_ru', installs: '1.2k', glyph: 'σ', color: '#B58300',
    render: ({ portfolio }) => <KpiCard label="Волатильность" value={(portfolio.metrics.vol * 100).toFixed(1).replace('.', ',') + '%'} sub="годовая" />
  },
  'kpi-calmar': {
    title: 'Calmar Ratio', sub: 'Годовая доходность ÷ max просадка. Альтернатива Sharpe для хвостовых рисков.',
    size: 'xs', author: '@riskmodel', installs: '480', glyph: 'C', color: '#8C5BD7',
    render: ({ portfolio }) => <KpiCard label="Calmar" value={(portfolio.metrics.annRet / Math.abs(portfolio.metrics.maxDD || 1)).toFixed(2)} sub="ret/MaxDD" />
  },

  // ---- Charts ----
  'equity': {
    title: 'Стоимость и бенчмарк', sub: 'Динамика портфеля относительно IMOEX-прокси.',
    size: 'full', official: true, glyph: '◢', color: 'var(--ink)',
    render: ({ portfolio, range }) => {
      const { series, startV, endV, rangeDelta, rangeDeltaPct } = getValueCtx(portfolio, range);
      const sber = CURS_DATA.asset('SBER').series.slice(-series.length);
      const bScale = startV / sber[0].v;
      const bench = sber.map(p => ({ d: p.d, v: p.v * bScale * 0.94 }));
      return (
        <div className="card">
          <div className="row between" style={{marginBottom: 12}}>
            <div className="col" style={{gap: 4}}>
              <div className="mini" style={{textTransform: 'uppercase', letterSpacing: '0.05em'}}>Стоимость портфеля</div>
              <div className="row" style={{gap: 10, alignItems: 'baseline'}}>
                <span className="mono mask" style={{fontSize: 28, fontWeight: 600, letterSpacing: '-0.025em'}}>
                  {CURS_CHARTS.fmtMoneyCompact(endV)}<span style={{fontSize: 14, color: 'var(--ink-3)'}}> ₽</span>
                </span>
                <CURS_UI.PercentDelta value={rangeDeltaPct} abs={rangeDelta} />
                <span className="mini" style={{marginLeft: 4}}>за {range}</span>
              </div>
            </div>
          </div>
          <CURS_CHARTS.LineAreaChart
            series={series} compareSeries={bench} height={280}
            color="#15140F" areaFrom="rgba(21,20,15,.10)" areaTo="rgba(21,20,15,0)"
          />
          <div className="row gap-md mini" style={{marginTop: 6}}>
            <span className="row gap-sm"><span style={{width: 14, height: 2, background: 'var(--ink)'}}></span>{portfolio.name}</span>
            <span className="row gap-sm"><span style={{width: 14, height: 1, borderBottom: '1.5px dashed #B5B1A6'}}></span>IMOEX</span>
            <span style={{marginLeft: 'auto', fontFamily: 'var(--mono)'}}>
              CAGR <strong>{(portfolio.metrics.annRet * 100).toFixed(1).replace('.', ',')}%</strong> · σ <strong>{(portfolio.metrics.vol * 100).toFixed(1).replace('.', ',')}%</strong>
            </span>
          </div>
        </div>
      );
    }
  },

  'structure': {
    title: 'Структура портфеля', sub: 'Treemap позиций по доле в портфеле.',
    size: 'md', official: true, glyph: '▦', color: '#2F4858',
    render: ({ portfolio }) => {
      const pv = CURS_DATA.portfolioValue(portfolio);
      const items = pv.positions.slice().sort((a, b) => b.valBase - a.valBase).slice(0, 12).map((p, i) => ({
        label: p.asset.id,
        value: p.valBase,
        share: (p.valBase / pv.total * 100).toFixed(1).replace('.', ',') + '%',
        color: ['#15140F','#2F4858','#86B0A0','#D7E041','#EE7544','#4F6BED','#B58300','#8C5BD7','#1F8F6F','#C0392B','#4A4842','#B5B1A6'][i],
      }));
      return (
        <div className="card">
          <h3 className="section-title lg" style={{marginBottom: 14}}>Структура портфеля</h3>
          <CURS_CHARTS.Treemap items={items} height={300} />
        </div>
      );
    }
  },

  'classes': {
    title: 'По классам активов', sub: 'Распределение между трад. финансами, криптой и валютами.',
    size: 'md', official: true, glyph: '◐', color: '#86B0A0',
    render: ({ portfolio }) => {
      const pv = CURS_DATA.portfolioValue(portfolio);
      const byClass = { tradfi: 0, crypto: 0, fiat: 0 };
      pv.positions.forEach(p => { byClass[p.asset.class] += p.valBase; });
      const items = Object.entries(byClass).filter(([,v]) => v > 0).map(([k, v]) => ({
        label: CURS_DATA.CLASS_LABEL[k], value: v, color: CURS_DATA.CLASS_COLOR[k],
        share: (v / pv.total * 100).toFixed(1).replace('.', ',') + '%',
      }));
      return (
        <div className="card">
          <h3 className="section-title lg" style={{marginBottom: 14}}>По классам</h3>
          <div className="row" style={{gap: 18}}>
            <CURS_CHARTS.Donut items={items} size={140} thickness={20} />
            <div className="col" style={{gap: 10, flex: 1}}>
              {items.map((it, i) => (
                <div key={i} className="row between">
                  <div className="row gap-sm">
                    <span style={{width: 10, height: 10, borderRadius: 2, background: it.color}}></span>
                    <span style={{fontSize: 13, fontWeight: 500}}>{it.label}</span>
                  </div>
                  <span className="kvalue" style={{fontSize: 12}}>{it.share}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
  },

  'drawdown': {
    title: 'Просадка', sub: 'Глубина и длительность просадок от пика.',
    size: 'full', official: true, glyph: '↘', color: 'var(--down)',
    render: ({ portfolio, range }) => {
      const days = CURS_UI.RANGE_DAYS[range];
      const series = portfolio.series.slice(-days);
      return (
        <div className="card">
          <h3 className="section-title lg" style={{marginBottom: 14}}>Просадка</h3>
          <CURS_CHARTS.DrawdownChart series={series} height={180} />
        </div>
      );
    }
  },

  // ---- Community widgets ----
  'frontier': {
    title: 'Эффективная граница', sub: 'Markowitz: 600 рандомных портфелей и оптимальная граница риск/доходность.',
    size: 'lg', author: '@markowitz_ru', installs: '3.2k', glyph: '◣', color: '#15140F',
    render: ({ portfolio }) => <FrontierWidget portfolio={portfolio} />
  },

  'montecarlo': {
    title: 'Монте-Карло', sub: 'Стохастические симуляции будущей стоимости портфеля.',
    size: 'lg', author: '@quants', installs: '2.7k', glyph: '〰', color: '#4F6BED',
    render: ({ portfolio }) => <MonteCarloWidget portfolio={portfolio} />
  },

  'correlation': {
    title: 'Корреляции', sub: 'Матрица ρ между активами портфеля (без фиатных).',
    size: 'md', author: '@diversify', installs: '1.8k', glyph: '▦', color: '#C0392B',
    render: ({ portfolio }) => {
      const ids = portfolio.positions.map(p => p.assetId).filter(id => CURS_DATA.asset(id).class !== 'fiat');
      const matrix = CURS_DATA.corrMatrix(ids);
      return (
        <div className="card">
          <h3 className="section-title lg" style={{marginBottom: 14}}>Матрица корреляций</h3>
          <CURS_CHARTS.Heatmap labels={ids} matrix={matrix} size={32} />
        </div>
      );
    }
  },

  'corr-pairs': {
    title: 'Лучшие диверсификаторы', sub: 'Пары с самой низкой и самой высокой корреляцией.',
    size: 'md', author: '@diversify', installs: '910', glyph: '⇋', color: '#1F8F6F',
    render: ({ portfolio }) => {
      const ids = portfolio.positions.map(p => p.assetId).filter(id => CURS_DATA.asset(id).class !== 'fiat');
      const idObjs = ids.map(id => CURS_DATA.asset(id));
      const matrix = CURS_DATA.corrMatrix(ids);
      const pairs = [];
      for (let i = 0; i < ids.length; i++)
        for (let j = i + 1; j < ids.length; j++)
          pairs.push({ a: idObjs[i], b: idObjs[j], v: matrix[i][j] });
      const top = pairs.slice().sort((a,b) => b.v - a.v).slice(0, 3);
      const low = pairs.slice().sort((a,b) => a.v - b.v).slice(0, 3);
      return (
        <div className="card">
          <h3 className="section-title lg" style={{marginBottom: 12}}>Корреляция пар</h3>
          <div className="mini" style={{marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em'}}>Самые связанные</div>
          <div className="col" style={{gap: 4, marginBottom: 14}}>
            {top.map((p, i) => <PairRow key={'t'+i} a={p.a} b={p.b} v={p.v} />)}
          </div>
          <div className="mini" style={{marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em'}}>Лучшая диверсификация</div>
          <div className="col" style={{gap: 4}}>
            {low.map((p, i) => <PairRow key={'l'+i} a={p.a} b={p.b} v={p.v} good />)}
          </div>
        </div>
      );
    }
  },

  'monthly': {
    title: 'Месячная доходность', sub: 'Сетка доходностей по месяцам — где у портфеля стабильные периоды.',
    size: 'full', author: '@returns_ru', installs: '650', glyph: '▤', color: '#EE7544',
    render: ({ portfolio }) => <MonthlyReturnsWidget portfolio={portfolio} />
  },
};

// ============================================
// Heavy widgets (live state)
// ============================================
function FrontierWidget({ portfolio }) {
  const result = anUseMemo(() => buildFrontier(portfolio), [portfolio.id]);
  if (!result) return <div className="card"><span className="muted">Недостаточно активов</span></div>;
  const { cloud, frontier, current, optimal, minvar } = result;
  return (
    <div className="card">
      <div className="row between" style={{marginBottom: 12}}>
        <div className="col" style={{gap: 4}}>
          <h3 className="section-title lg">Эффективная граница</h3>
          <div className="mini">Лучшая доходность для каждого уровня риска.</div>
        </div>
        <span className="pill ghost">σ × E(R) · 600</span>
      </div>
      <CURS_CHARTS.FrontierChart portfolios={cloud} frontier={frontier} current={current} optimal={optimal} minvar={minvar} height={340} />
    </div>
  );
}

function MonteCarloWidget({ portfolio }) {
  const [horizon, setHorizon] = anUseState(252);
  const result = anUseMemo(() => runMC(portfolio, horizon, 300), [portfolio.id, horizon]);
  return (
    <div className="card">
      <div className="row between" style={{marginBottom: 12, alignItems: 'flex-start'}}>
        <div className="col" style={{gap: 4}}>
          <h3 className="section-title lg">Монте-Карло</h3>
          <div className="mini">Стохастические траектории, 300 сценариев.</div>
        </div>
        <div className="row gap-sm">
          {[126, 252, 504, 756].map(d => (
            <button key={d} className={'range-tab ' + (horizon === d ? 'active' : '')} onClick={() => setHorizon(d)}>
              {Math.round(d/21)}м
            </button>
          ))}
        </div>
      </div>
      <CURS_CHARTS.MonteCarloFan paths={result.paths} percentiles={result.percentiles} days={horizon} startValue={result.startV} target={result.target} height={300} />
    </div>
  );
}

function MonthlyReturnsWidget({ portfolio }) {
  // Compute monthly returns from portfolio series
  const months = anUseMemo(() => {
    const s = portfolio.series;
    const byMonth = {};
    s.forEach(pt => {
      const d = new Date(pt.d);
      const key = d.getFullYear() + '-' + (d.getMonth());
      if (!byMonth[key]) byMonth[key] = { first: pt.v, last: pt.v, y: d.getFullYear(), m: d.getMonth() };
      byMonth[key].last = pt.v;
    });
    return Object.values(byMonth).map(m => ({ ...m, ret: (m.last - m.first) / m.first }));
  }, [portfolio.id]);

  const maxAbs = Math.max(...months.map(m => Math.abs(m.ret)));
  const monthNames = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
  const years = [...new Set(months.map(m => m.y))].sort();

  return (
    <div className="card">
      <h3 className="section-title lg" style={{marginBottom: 14}}>Месячная доходность</h3>
      <div className="months-grid" style={{gridTemplateColumns: `60px repeat(12, 1fr)`}}>
        <div></div>
        {monthNames.map(n => <div key={n} className="mini" style={{textAlign:'center', textTransform:'uppercase'}}>{n}</div>)}
        {years.map(y => (
          <React.Fragment key={y}>
            <div className="mini" style={{alignSelf:'center'}}>{y}</div>
            {monthNames.map((_, mi) => {
              const m = months.find(mm => mm.y === y && mm.m === mi);
              if (!m) return <div key={mi} className="month-cell empty"></div>;
              const intensity = Math.min(1, Math.abs(m.ret) / maxAbs);
              const bg = m.ret >= 0
                ? `rgba(47,125,67, ${0.15 + intensity * 0.6})`
                : `rgba(192,57,43, ${0.15 + intensity * 0.6})`;
              return (
                <div key={mi} className="month-cell" style={{background: bg}} title={`${monthNames[mi]} ${y}: ${(m.ret*100).toFixed(1)}%`}>
                  <span className="mono" style={{fontSize: 11, fontWeight: 600, color: Math.abs(m.ret) > maxAbs * 0.6 ? '#fff' : 'var(--ink)'}}>
                    {(m.ret * 100).toFixed(1).replace('.', ',')}
                  </span>
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function PairRow({ a, b, v, good }) {
  return (
    <div className="row between" style={{padding: '6px 0', borderBottom: '1px solid var(--hairline-2)'}}>
      <div className="row gap-sm">
        <CURS_UI.AssetIcon asset={a} size={22} />
        <span style={{fontSize: 11, color: 'var(--ink-3)'}}>×</span>
        <CURS_UI.AssetIcon asset={b} size={22} />
        <span style={{fontSize: 12, fontFamily: 'var(--mono)', marginLeft: 4}}>{a.id} × {b.id}</span>
      </div>
      <span className="kvalue" style={{color: good ? 'var(--up)' : 'var(--down)', fontSize: 13, fontWeight: 600}}>ρ = {v.toFixed(2)}</span>
    </div>
  );
}

// ============================================
// Math helpers
// ============================================
function buildFrontier(portfolio) {
  const ids = portfolio.positions.slice(0, 6).map(p => p.assetId);
  const assets = ids.map(id => CURS_DATA.asset(id));
  if (assets.length < 2) return null;
  const mus = assets.map(a => a.mu || 0.1);
  const sigmas = assets.map(a => a.sigma || 0.2);
  function mulberry(s) {
    return function () {
      s += 0x6d2b79f5; let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry(99);
  const cloud = [];
  for (let i = 0; i < 600; i++) {
    const w = assets.map(() => rnd());
    const s = w.reduce((a, b) => a + b, 0);
    const ww = w.map(x => x / s);
    let mu = 0, sig2 = 0;
    for (let j = 0; j < ww.length; j++) mu += ww[j] * mus[j];
    for (let j = 0; j < ww.length; j++)
      for (let k = 0; k < ww.length; k++) {
        const rho = j === k ? 1 : 0.3;
        sig2 += ww[j] * ww[k] * sigmas[j] * sigmas[k] * rho;
      }
    cloud.push({ risk: Math.sqrt(sig2), ret: mu });
  }
  const minR = Math.min(...cloud.map(p => p.risk)), maxR = Math.max(...cloud.map(p => p.risk));
  const bins = 40, frontier = [];
  for (let i = 0; i < bins; i++) {
    const r0 = minR + (maxR - minR) * i / bins, r1 = minR + (maxR - minR) * (i + 1) / bins;
    const sub = cloud.filter(p => p.risk >= r0 && p.risk < r1);
    if (!sub.length) continue;
    frontier.push(sub.reduce((a, b) => b.ret > a.ret ? b : a, sub[0]));
  }
  frontier.sort((a, b) => a.risk - b.risk);
  const sm = frontier.filter((p, i) => i === 0 || p.ret >= frontier[i - 1].ret);
  const current = { risk: portfolio.metrics.vol, ret: portfolio.metrics.annRet };
  let bestSh = -Infinity, optimal = sm[0];
  sm.forEach(p => { const sh = (p.ret - 0.07) / p.risk; if (sh > bestSh) { bestSh = sh; optimal = p; } });
  const minvar = sm.reduce((a, b) => b.risk < a.risk ? b : a, sm[0]);
  return { cloud, frontier: sm, current, optimal, minvar };
}

function runMC(portfolio, horizon, nSims) {
  const startV = portfolio.series[portfolio.series.length - 1].v;
  const mu = portfolio.metrics.annRet, sigma = portfolio.metrics.vol;
  function mulberry(s) {
    return function () {
      s += 0x6d2b79f5; let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry(42);
  function norm() { const u = Math.max(1e-9, rnd()), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  const paths = [];
  for (let s = 0; s < nSims; s++) {
    const path = [startV]; let px = startV;
    for (let t = 1; t < horizon; t++) { const z = norm(); px = px * (1 + mu / 252 + sigma / Math.sqrt(252) * z); path.push(px); }
    paths.push(path);
  }
  function pct(arr, p) { return arr[Math.floor(arr.length * p)]; }
  const pcts = { p10: [], p25: [], p50: [], p75: [], p90: [] };
  for (let t = 0; t < horizon; t++) {
    const col = paths.map(p => p[t]).sort((a, b) => a - b);
    pcts.p10.push(pct(col, 0.10)); pcts.p25.push(pct(col, 0.25));
    pcts.p50.push(pct(col, 0.50)); pcts.p75.push(pct(col, 0.75)); pcts.p90.push(pct(col, 0.90));
  }
  return { paths, percentiles: pcts, startV, target: startV * 1.3 };
}

window.CURS_ANALYTICS = { AnalyticsScreen };
