// CURS — Calc tab: transaction planner
// Plan any kind of transaction (buy/sell/swap/in/out/div) and convert them into real entries.
const { useState: cUseState, useMemo: cUseMemo, useEffect: cUseEffect, useRef: cUseRef } = React;

const PLANS_STORAGE = 'curs.calc.plans.v2';
let _planUid = Date.now();
const newPlanId = () => 'pl' + (++_planUid);
const newTxId   = () => 'tx_' + (++_planUid);

// ===================================================
// Type metadata
// ===================================================
const PT = {
  buy:  { label: 'Покупка',    icon: '↑', tone: 'asset-in',  bg: 'rgba(47,125,67,.10)',   color: 'var(--up)' },
  sell: { label: 'Продажа',    icon: '↓', tone: 'asset-out', bg: 'rgba(192,57,43,.10)',   color: 'var(--down)' },
  tx:   { label: 'Транзакция', icon: '⇄', tone: 'swap',      bg: 'var(--surface-3)',      color: 'var(--ink-2)' },
  in:   { label: 'Пополнение', icon: '＋', tone: 'cash-in',   bg: 'var(--up-soft)',        color: 'var(--up-ink)' },
  out:  { label: 'Вывод',      icon: '−', tone: 'cash-out',  bg: 'var(--down-soft)',      color: 'var(--down-ink)' },
  div:  { label: 'Дивиденд',   icon: '◆', tone: 'cash-in',   bg: 'var(--warn-soft)',      color: 'var(--warn)' },
};

// ===================================================
// Screen
// ===================================================
function CalcScreen({ portfolios, onExecute }) {
  // Holdings: aggregate non-fiat positions
  const holdings = cUseMemo(() => buildHoldings(portfolios), [portfolios]);

  // Plans
  const [plans, setPlans] = cUseState(() => {
    try { const raw = localStorage.getItem(PLANS_STORAGE); if (raw) return JSON.parse(raw); } catch (e) {}
    return [];
  });
  cUseEffect(() => { try { localStorage.setItem(PLANS_STORAGE, JSON.stringify(plans)); } catch (e) {} }, [plans]);

  // Draft form state
  const [draft, setDraft] = cUseState(null);
  const [toast, setToast] = cUseState(null);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2400); }
  function startAdd() { setDraft(emptyDraft(portfolios)); }
  function startEdit(p) { setDraft({ ...p }); }
  function saveDraft() {
    if (!draft) return;
    const p = { ...draft, id: draft.id || newPlanId() };
    setPlans(ps => draft.id ? ps.map(x => x.id === p.id ? p : x) : [...ps, p]);
    setDraft(null);
  }
  function deletePlan(id) { setPlans(ps => ps.filter(p => p.id !== id)); }
  function clearAll() { if (window.confirm('Удалить все планы?')) setPlans([]); }
  function executePlan(p) {
    const tx = planToTx(p);
    if (!tx) return;
    onExecute([tx]);
    setPlans(ps => ps.filter(x => x.id !== p.id));
    showToast(`${PT[p.type].label} записана в журнал`);
  }
  function executeAll() {
    if (plans.length === 0) return;
    if (!window.confirm(`Записать все ${plans.length} ${pluralPlans(plans.length)} в журнал?`)) return;
    onExecute(plans.map(planToTx).filter(Boolean));
    setPlans([]);
    showToast('Все планы записаны');
  }

  // Aggregates for hero
  const agg = cUseMemo(() => aggregatePlans(plans, holdings), [plans, holdings]);

  return (
    <div className="content" style={{maxWidth: 1480}}>
      <div className="page-head">
        <div>
          <div className="title">Планировщик</div>
          <div className="sub">
            {plans.length === 0
              ? 'Запланируйте сделки наперёд — потом одной кнопкой превратите их в реальные записи'
              : `${plans.length} ${pluralPlans(plans.length)} в плане`}
          </div>
        </div>
        <div className="right">
          {plans.length > 0 && (
            <>
              <button className="btn" onClick={clearAll}>Очистить</button>
              <button className="btn primary" onClick={executeAll}>Записать все</button>
            </>
          )}
        </div>
      </div>

      <CalcHero agg={agg} empty={plans.length === 0} />

      <div className="grid" style={{gridTemplateColumns: '1.7fr 1fr', gap: 22, alignItems: 'flex-start'}}>
        <div className="col" style={{gap: 12}}>
          {plans.map(p => {
            if (draft && draft.id === p.id) {
              return <PlanForm key={p.id} draft={draft} setDraft={setDraft}
                portfolios={portfolios} holdings={holdings}
                onSave={saveDraft} onCancel={() => setDraft(null)} />;
            }
            return <PlanCard key={p.id} plan={p} portfolios={portfolios} holdings={holdings}
              onEdit={() => startEdit(p)} onDelete={() => deletePlan(p.id)} onExecute={() => executePlan(p)} />;
          })}

          {draft && !draft.id && (
            <PlanForm draft={draft} setDraft={setDraft}
              portfolios={portfolios} holdings={holdings}
              onSave={saveDraft} onCancel={() => setDraft(null)} />
          )}

          {!draft && (
            <button className="add-plan-btn" onClick={startAdd}>
              {CURS_UI.I.plus()}<span>Запланировать сделку</span>
            </button>
          )}

          {plans.length === 0 && !draft && (
            <div className="empty-state">
              <div style={{fontSize: 38, marginBottom: 8}}>🗓️</div>
              <div style={{fontSize: 15, fontWeight: 600, marginBottom: 4}}>Спланируйте сделки</div>
              <div className="mini" style={{maxWidth: 360, textAlign: 'center', lineHeight: 1.5}}>
                Покупка SBER на 50к, продажа BTC после +30%, перевод USD → крипта. Сделайте список — потом по одной превращайте в реальные записи.
              </div>
            </div>
          )}
        </div>

        <div className="col" style={{gap: 18, position: 'sticky', top: 92}}>
          <FlowBreakdown agg={agg} portfolios={portfolios} />
          <TypesBreakdown plans={plans} />
        </div>
      </div>

      {toast && (
        <div className="toast">✓ {toast}</div>
      )}
    </div>
  );
}

// ===================================================
// Hero
// ===================================================
function CalcHero({ agg, empty }) {
  const net = agg.netCashFlow;
  return (
    <div className="calc-hero">
      <div className="calc-hero-main">
        <div className="mini" style={{textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8}}>
          {empty ? 'Кэш-флоу' : 'Чистый денежный поток'}
        </div>
        <div className="row" style={{gap: 14, alignItems: 'baseline', flexWrap: 'wrap'}}>
          <h1 className={'calc-num mask ' + (net > 0 ? 'up' : net < 0 ? 'down' : '')}>
            {empty || net === 0 ? '0' : (net > 0 ? '+' : '−') + CURS_CHARTS.fmtMoneyCompact(Math.abs(net))}
          </h1>
          <span className="hero-ccy">₽</span>
        </div>
        <div className="mini" style={{marginTop: 6}}>
          {empty ? 'добавьте планы ниже, чтобы увидеть результат'
                 : 'поступит на счёт за вычетом потраченного'}
        </div>
      </div>
      <div className="calc-hero-stats">
        <CalcStat label="Покупки" value={CURS_DATA.fmtRUB(agg.buyCost, { compact: true })} sub={agg.buyCount + ' ' + pluralPlans(agg.buyCount)} tone={agg.buyCost > 0 ? 'down' : null} />
        <CalcStat label="Продажи" value={CURS_DATA.fmtRUB(agg.sellProceeds, { compact: true })} sub={agg.sellCount + ' ' + pluralPlans(agg.sellCount)} tone={agg.sellProceeds > 0 ? 'up' : null} />
        <CalcStat label="Заработок с продаж" value={(agg.sellProfit > 0 ? '+' : agg.sellProfit < 0 ? '−' : '') + CURS_CHARTS.fmtMoneyCompact(Math.abs(agg.sellProfit)) + ' ₽'} sub="над cost basis" tone={agg.sellProfit > 0 ? 'up' : agg.sellProfit < 0 ? 'down' : null} />
      </div>
    </div>
  );
}

function CalcStat({ label, value, sub, tone }) {
  return (
    <div className="col" style={{gap: 4, padding: '14px 16px', borderLeft: '1px solid var(--hairline)'}}>
      <span className="mini" style={{textTransform: 'uppercase', letterSpacing: '0.06em'}}>{label}</span>
      <span className="mono mask" style={{fontSize: 18, fontWeight: 600, letterSpacing: '-0.015em', color: tone === 'up' ? 'var(--up)' : tone === 'down' ? 'var(--down)' : 'var(--ink)'}}>{value}</span>
      <span className="mini">{sub}</span>
    </div>
  );
}

// ===================================================
// Sidebar — flow per portfolio
// ===================================================
function FlowBreakdown({ agg, portfolios }) {
  const hasFlow = Object.values(agg.byPortfolio).some(v => v.in !== 0 || v.out !== 0);
  return (
    <div className="card">
      <h3 className="section-title lg" style={{marginBottom: 12}}>По портфелям</h3>
      {!hasFlow && <div className="mini" style={{padding: '6px 0'}}>Кэш-флоу не запланирован</div>}
      <div className="col" style={{gap: 12}}>
        {portfolios.map(pf => {
          const f = agg.byPortfolio[pf.id] || { in: 0, out: 0 };
          const net = f.in - f.out;
          const total = f.in + f.out || 1;
          return (
            <div key={pf.id}>
              <div className="row between" style={{marginBottom: 6}}>
                <div className="row gap-sm">
                  <span style={{width: 10, height: 10, borderRadius: 3, background: pf.color}}></span>
                  <span style={{fontSize: 13, fontWeight: 500}}>{pf.name}</span>
                </div>
                <span className={'kvalue mask ' + (net > 0 ? 'delta up' : net < 0 ? 'delta down' : '')} style={{fontSize: 13, fontWeight: 600}}>
                  {net === 0 ? '—' : (net > 0 ? '+' : '−') + CURS_CHARTS.fmtMoneyCompact(Math.abs(net)) + ' ₽'}
                </span>
              </div>
              <div className="flow-bar">
                <div className="flow-in" style={{flex: f.in}}></div>
                <div className="flow-out" style={{flex: f.out}}></div>
              </div>
              <div className="row between mini" style={{marginTop: 3}}>
                <span className="up mask">+{CURS_CHARTS.fmtMoneyCompact(f.in)}</span>
                <span className="down mask">−{CURS_CHARTS.fmtMoneyCompact(f.out)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TypesBreakdown({ plans }) {
  const counts = {};
  plans.forEach(p => { counts[p.type] = (counts[p.type] || 0) + 1; });
  const keys = Object.keys(PT).filter(k => counts[k]);
  if (keys.length === 0) return null;
  return (
    <div className="card">
      <h3 className="section-title lg" style={{marginBottom: 12}}>По типам</h3>
      <div className="col" style={{gap: 8}}>
        {keys.map(k => (
          <div key={k} className="row between">
            <div className="row gap-sm">
              <span className="plan-type-mark" style={{background: PT[k].bg, color: PT[k].color}}>{PT[k].icon}</span>
              <span style={{fontSize: 13, fontWeight: 500}}>{PT[k].label}</span>
            </div>
            <span className="kvalue" style={{fontSize: 12}}>{counts[k]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===================================================
// Plan card (display)
// ===================================================
function PlanCard({ plan, portfolios, holdings, onEdit, onDelete, onExecute }) {
  const pf = portfolios.find(p => p.id === plan.portfolioId);
  const summary = describePlan(plan, holdings);
  const meta = PT[plan.type];

  return (
    <div className={'plan-card ' + (summary.warn ? 'warn' : '')}>
      <span className="plan-type-mark lg" style={{background: meta.bg, color: meta.color}}>{meta.icon}</span>

      <div className="col" style={{flex: 1, minWidth: 0, gap: 4}}>
        <div className="row gap-sm" style={{alignItems: 'baseline', flexWrap: 'wrap'}}>
          <span style={{fontWeight: 600, fontSize: 15}}>{summary.title}</span>
          {summary.warn && <span className="pill" style={{background: 'var(--down-soft)', color: 'var(--down-ink)', borderColor: 'transparent'}}>{summary.warn}</span>}
        </div>
        <div className="mini">{summary.sub}</div>
        <div className="plan-portfolios">
          {pf && (
            <span className="plan-pf">
              <span className="dot" style={{background: pf.color}}></span>{pf.name}
            </span>
          )}
          <span className="plan-pf"><span className="muted">{fmtDateShort(plan.date)}</span></span>
        </div>
      </div>

      <div className="col" style={{alignItems: 'flex-end', gap: 4, minWidth: 140}}>
        {summary.amount && (
          <>
            <span className="mini" style={{textTransform: 'uppercase', letterSpacing: '0.05em'}}>{summary.amountLabel}</span>
            <span className={'mono mask ' + (summary.amountTone === 'up' ? 'delta up' : summary.amountTone === 'down' ? 'delta down' : '')} style={{fontSize: 18, fontWeight: 600}}>{summary.amount}</span>
            {summary.subAmount && <span className="mini">{summary.subAmount}</span>}
          </>
        )}
      </div>

      <div className="plan-actions">
        <button className="btn sm primary" onClick={onExecute} title="Записать в журнал">Записать</button>
        <div className="row gap-sm">
          <button className="btn icon ghost" onClick={onEdit} title="Изменить">✎</button>
          <button className="btn icon ghost" onClick={onDelete} title="Удалить">{CURS_UI.I.close()}</button>
        </div>
      </div>
    </div>
  );
}

// ===================================================
// Form (add/edit)
// ===================================================
function PlanForm({ draft, setDraft, portfolios, holdings, onSave, onCancel }) {
  function set(k, v) { setDraft(d => ({ ...d, [k]: v })); }
  function setType(type) {
    // reset type-specific fields
    setDraft(d => ({ ...emptyDraft(portfolios, d), id: d.id, portfolioId: d.portfolioId, date: d.date, type }));
  }

  const fiats = CURS_DATA.ASSETS.filter(a => a.class === 'fiat');
  const allAssets = CURS_DATA.ASSETS;
  const tradableAssets = CURS_DATA.ASSETS.filter(a => a.class !== 'fiat');

  return (
    <div className="plan-form">
      <div className="plan-form-head">
        <span style={{fontWeight: 600, fontSize: 14}}>{draft.id ? 'Изменить план' : 'Новый план'}</span>
        <button className="btn icon ghost" onClick={onCancel}>{CURS_UI.I.close()}</button>
      </div>

      {/* Type picker */}
      <div className="type-grid">
        {Object.entries(PT).map(([k, m]) => (
          <button key={k} className={'type-btn ' + (draft.type === k ? 'active' : '')} onClick={() => setType(k)}>
            <span className="type-mark" style={{background: m.bg, color: m.color}}>{m.icon}</span>
            <span>{m.label}</span>
          </button>
        ))}
      </div>

      {/* Common: portfolio + date */}
      <div className="grid grid-2" style={{gap: 12}}>
        <div className="field">
          <div className="field-label">Портфель</div>
          <select className="inp" value={draft.portfolioId} onChange={e => set('portfolioId', e.target.value)}>
            {portfolios.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="field">
          <div className="field-label">Дата</div>
          <input className="inp" type="date" value={draft.date} onChange={e => set('date', e.target.value)} />
        </div>
      </div>

      {/* Type-specific */}
      {draft.type === 'buy'  && <BuyForm  draft={draft} set={set} fiats={fiats} tradable={tradableAssets} />}
      {draft.type === 'sell' && <SellForm draft={draft} set={set} fiats={fiats} holdings={holdings} />}
      {draft.type === 'tx'   && <TxForm   draft={draft} set={set} allAssets={allAssets} />}
      {(draft.type === 'in' || draft.type === 'out') && <InOutForm draft={draft} set={set} fiats={fiats} label={draft.type === 'in' ? 'Вносится' : 'Снимается'} />}
      {draft.type === 'div'  && <DivForm  draft={draft} set={set} fiats={fiats} tradable={tradableAssets} />}

      {/* Live preview */}
      <PlanPreview draft={draft} holdings={holdings} />

      <div className="row" style={{justifyContent: 'flex-end', gap: 8}}>
        <button className="btn" onClick={onCancel}>Отмена</button>
        <button className="btn primary" disabled={!validateDraft(draft)} onClick={onSave}>
          {draft.id ? 'Сохранить' : 'Добавить в план'}
        </button>
      </div>
    </div>
  );
}

// ---- Type-specific sub-forms ----
function BuyForm({ draft, set, fiats, tradable }) {
  const asset = CURS_DATA.asset(draft.assetId);
  const ccySym = asset ? ccyOfCash(draft.cashAsset || asset.ccy) : '₽';
  function quickPrice(pct) { if (asset) set('price', String(round(asset.price * (1 + pct), asset.price))); }
  return (
    <>
      <AssetSelect label="Что покупаем" value={draft.assetId} onChange={v => {
        set('assetId', v);
        const a = CURS_DATA.asset(v);
        if (a) { set('price', String(a.price)); set('cashAsset', a.ccy); }
      }} assets={tradable} />

      <div className="grid grid-2" style={{gap: 12}}>
        <div className="field">
          <div className="field-label">Количество</div>
          <input className="inp" type="number" placeholder="0" value={draft.qty} onChange={e => set('qty', e.target.value)} />
        </div>
        <div className="field">
          <div className="field-label">Цена за единицу</div>
          <div className="inp-row">
            <input className="inp" type="number" placeholder="0" value={draft.price} onChange={e => set('price', e.target.value)} />
            <span className="inp-suffix">{ccySym}</span>
          </div>
          {asset && (
            <div className="quick-chips" style={{marginTop: 6}}>
              <button className="preset-pill" onClick={() => quickPrice(-0.10)}>−10%</button>
              <button className="preset-pill" onClick={() => quickPrice(0)}>текущая</button>
              <button className="preset-pill" onClick={() => quickPrice(0.10)}>+10%</button>
            </div>
          )}
        </div>
      </div>
      <div className="field">
        <div className="field-label">Платим из</div>
        <select className="inp" value={draft.cashAsset} onChange={e => set('cashAsset', e.target.value)}>
          {fiats.map(f => <option key={f.id} value={f.id}>{f.id} · {f.name}</option>)}
        </select>
      </div>
    </>
  );
}

function SellForm({ draft, set, fiats, holdings }) {
  const h = holdings[draft.assetId];
  const asset = h ? h.asset : null;
  const ccySym = draft.cashAsset === 'USD' ? '$' : draft.cashAsset === 'EUR' ? '€' : '₽';
  function quickQty(frac) { if (h) set('qty', String(roundQty(h.qty * frac, h.asset))); }
  function quickPrice(pct) { if (asset) set('price', String(round(asset.price * (1 + pct), asset.price))); }
  return (
    <>
      <div className="field">
        <div className="field-label">Что продаём</div>
        <select className="inp" value={draft.assetId} onChange={e => {
          set('assetId', e.target.value);
          const a = CURS_DATA.asset(e.target.value);
          if (a) { set('price', String(a.price)); set('cashAsset', a.ccy); }
        }}>
          <option value="">Выберите актив…</option>
          {Object.values(holdings).map(hh => (
            <option key={hh.asset.id} value={hh.asset.id}>{hh.asset.id} · {hh.asset.name} (есть {CURS_DATA.fmtQty(hh.qty)})</option>
          ))}
        </select>
        {h && (
          <div className="mini" style={{marginTop: 4}}>
            Доступно: <strong style={{color: 'var(--ink)'}}>{CURS_DATA.fmtQty(h.qty)} {h.asset.id}</strong> · ср. цена {CURS_DATA.fmtCcy(h.totalCostBase / h.qty, 'RUB', { decimals: 0 })}
          </div>
        )}
      </div>

      <div className="grid grid-2" style={{gap: 12}}>
        <div className="field">
          <div className="field-label">Количество</div>
          <input className="inp" type="number" placeholder="0" value={draft.qty} onChange={e => set('qty', e.target.value)} />
          {h && (
            <div className="quick-chips" style={{marginTop: 6}}>
              {[0.25, 0.5, 0.75, 1].map(f => (
                <button key={f} className="preset-pill" onClick={() => quickQty(f)}>{f === 1 ? 'Всё' : (f * 100) + '%'}</button>
              ))}
            </div>
          )}
        </div>
        <div className="field">
          <div className="field-label">Цена за единицу</div>
          <div className="inp-row">
            <input className="inp" type="number" placeholder="0" value={draft.price} onChange={e => set('price', e.target.value)} />
            <span className="inp-suffix">{ccySym}</span>
          </div>
          {asset && (
            <div className="quick-chips" style={{marginTop: 6}}>
              <button className="preset-pill" onClick={() => quickPrice(0)}>текущая</button>
              <button className="preset-pill" onClick={() => quickPrice(0.10)}>+10%</button>
              <button className="preset-pill" onClick={() => quickPrice(0.30)}>+30%</button>
              <button className="preset-pill" onClick={() => quickPrice(0.50)}>+50%</button>
            </div>
          )}
        </div>
      </div>
      <div className="field">
        <div className="field-label">Деньги на</div>
        <select className="inp" value={draft.cashAsset} onChange={e => set('cashAsset', e.target.value)}>
          {fiats.map(f => <option key={f.id} value={f.id}>{f.id} · {f.name}</option>)}
        </select>
      </div>
    </>
  );
}

function TxForm({ draft, set, allAssets }) {
  function swap() {
    setRaw('fromAsset', draft.toAsset);
    setRaw('toAsset', draft.fromAsset);
    setRaw('fromQty', draft.toQty);
    setRaw('toQty', draft.fromQty);
  }
  function setRaw(k, v) { set(k, v); }
  return (
    <>
      <div className="field">
        <div className="field-label">Отдаём</div>
        <div className="inp-row">
          <select className="inp inp-asset" value={draft.fromAsset} onChange={e => set('fromAsset', e.target.value)}>
            {assetOptions(allAssets)}
          </select>
          <input className="inp" type="number" placeholder="0" value={draft.fromQty} onChange={e => set('fromQty', e.target.value)} />
        </div>
      </div>
      <div style={{textAlign: 'center'}}>
        <button className="btn icon" style={{margin: '0 auto'}} onClick={swap} title="Поменять местами">{CURS_UI.I.swap()}</button>
      </div>
      <div className="field">
        <div className="field-label">Получаем</div>
        <div className="inp-row">
          <select className="inp inp-asset" value={draft.toAsset} onChange={e => set('toAsset', e.target.value)}>
            {assetOptions(allAssets)}
          </select>
          <input className="inp" type="number" placeholder="0" value={draft.toQty} onChange={e => set('toQty', e.target.value)} />
        </div>
      </div>
    </>
  );
}

function InOutForm({ draft, set, fiats, label }) {
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      <div className="inp-row">
        <select className="inp inp-asset" value={draft.asset} onChange={e => set('asset', e.target.value)}>
          {fiats.map(f => <option key={f.id} value={f.id}>{f.id} · {f.name}</option>)}
        </select>
        <input className="inp" type="number" placeholder="0" value={draft.qty} onChange={e => set('qty', e.target.value)} />
      </div>
    </div>
  );
}

function DivForm({ draft, set, fiats, tradable }) {
  const cashSym = draft.cashAsset === 'USD' ? '$' : draft.cashAsset === 'EUR' ? '€' : '₽';
  return (
    <>
      <div className="grid grid-2" style={{gap: 12}}>
        <div className="field">
          <div className="field-label">Источник (актив)</div>
          <select className="inp" value={draft.source} onChange={e => set('source', e.target.value)}>
            <option value="">Выбрать…</option>
            {tradable.map(a => <option key={a.id} value={a.id}>{a.id} · {a.name}</option>)}
          </select>
        </div>
        <div className="field">
          <div className="field-label">Валюта выплаты</div>
          <select className="inp" value={draft.cashAsset} onChange={e => set('cashAsset', e.target.value)}>
            {fiats.map(f => <option key={f.id} value={f.id}>{f.id} · {f.name}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <div className="field-label">Сумма</div>
        <div className="inp-row">
          <input className="inp" type="number" placeholder="0" value={draft.qty} onChange={e => set('qty', e.target.value)} />
          <span className="inp-suffix">{cashSym}</span>
        </div>
      </div>
    </>
  );
}

// ---- Live preview inside form ----
function PlanPreview({ draft, holdings }) {
  const s = describePlan(draft, holdings);
  if (!s.amount && !s.profit) return null;
  return (
    <div className="plan-preview">
      {s.amount && (
        <div className="col" style={{gap: 2}}>
          <span className="mini" style={{textTransform: 'uppercase', letterSpacing: '0.06em'}}>{s.amountLabel}</span>
          <span className={'mono mask ' + (s.amountTone === 'up' ? 'delta up' : s.amountTone === 'down' ? 'delta down' : '')} style={{fontSize: 20, fontWeight: 600}}>{s.amount}</span>
        </div>
      )}
      {s.profit && (
        <div className="col" style={{gap: 2}}>
          <span className="mini" style={{textTransform: 'uppercase', letterSpacing: '0.06em'}}>Заработок</span>
          <span className={'mono mask ' + (s.profit.tone === 'up' ? 'delta up' : 'delta down')} style={{fontSize: 20, fontWeight: 600}}>{s.profit.value}</span>
          <span className="mini">{s.profit.sub}</span>
        </div>
      )}
      {s.rate && (
        <div className="col" style={{gap: 2}}>
          <span className="mini" style={{textTransform: 'uppercase', letterSpacing: '0.06em'}}>Курс</span>
          <span className="mono" style={{fontSize: 16, fontWeight: 600}}>{s.rate}</span>
        </div>
      )}
    </div>
  );
}

function AssetSelect({ label, value, onChange, assets }) {
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      <select className="inp" value={value} onChange={e => onChange(e.target.value)}>
        <option value="">Выбрать…</option>
        {assets.map(a => <option key={a.id} value={a.id}>{a.id} · {a.name}</option>)}
      </select>
    </div>
  );
}

function assetOptions(allAssets) {
  const groups = [
    ['fiat', 'Валюты'], ['tradfi', 'Трад. финансы'], ['crypto', 'Крипта']
  ];
  return groups.map(([k, label]) => {
    const arr = allAssets.filter(a => a.class === k);
    if (!arr.length) return null;
    return (
      <optgroup key={k} label={label}>
        {arr.map(a => <option key={a.id} value={a.id}>{a.id} · {a.name}</option>)}
      </optgroup>
    );
  });
}

// ===================================================
// Helpers
// ===================================================
function buildHoldings(portfolios) {
  const map = {};
  portfolios.forEach(pf => {
    pf.positions.forEach(pos => {
      const a = CURS_DATA.asset(pos.assetId);
      if (a.class === 'fiat') return;
      if (!map[a.id]) map[a.id] = { asset: a, qty: 0, totalCostBase: 0, byPortfolio: [] };
      const slot = map[a.id];
      const rate = CURS_DATA.rateToBase(a.ccy);
      slot.qty += pos.qty;
      slot.totalCostBase += pos.qty * pos.avgPrice * rate;
      slot.byPortfolio.push({ id: pf.id, name: pf.name, color: pf.color, qty: pos.qty });
    });
  });
  return map;
}

function emptyDraft(portfolios, prev) {
  const pid = (prev && prev.portfolioId) || (portfolios[0] && portfolios[0].id) || '';
  const date = (prev && prev.date) || new Date().toISOString().slice(0, 10);
  return {
    id: null, type: 'buy', portfolioId: pid, date,
    assetId: '', qty: '', price: '', cashAsset: 'RUB',
    fromAsset: 'RUB', fromQty: '', toAsset: 'SBER', toQty: '',
    asset: 'RUB', source: '',
  };
}

function validateDraft(d) {
  const q = parseFloat(d.qty), p = parseFloat(d.price);
  if (d.type === 'buy' || d.type === 'sell') return d.assetId && q > 0 && p > 0;
  if (d.type === 'tx') return d.fromAsset && d.toAsset && d.fromAsset !== d.toAsset && parseFloat(d.fromQty) > 0 && parseFloat(d.toQty) > 0;
  if (d.type === 'in' || d.type === 'out') return d.asset && q > 0;
  if (d.type === 'div') return d.source && d.cashAsset && q > 0;
  return false;
}

function ccyOfCash(id) { return id === 'USD' ? '$' : id === 'EUR' ? '€' : '₽'; }

// Build a human-readable summary + numbers for any plan
function describePlan(p, holdings) {
  if (!p || !validateDraft(p)) {
    // For form preview before fully valid — partial best-effort.
  }
  const out = { title: '', sub: '', amount: null, amountLabel: '', amountTone: '', subAmount: '', profit: null, rate: null, warn: null };

  if (p.type === 'buy') {
    const a = CURS_DATA.asset(p.assetId);
    if (!a) return { title: 'Покупка', sub: 'выбери актив' };
    const qty = parseFloat(p.qty) || 0;
    const price = parseFloat(p.price) || 0;
    const rate = CURS_DATA.rateToBase(a.ccy);
    const cost = qty * price * rate;
    out.title = `Купить ${CURS_DATA.fmtQty(qty)} ${a.id}`;
    out.sub = `по ${CURS_DATA.fmtCcy(price, a.ccy, { decimals: price > 1000 ? 0 : 2 })} · из ${p.cashAsset}`;
    out.amount = '−' + CURS_CHARTS.fmtMoneyCompact(cost) + ' ₽';
    out.amountLabel = 'Потратим';
    out.amountTone = 'down';
    if (Math.abs(price - a.price) / a.price > 0.001) {
      const pct = (price - a.price) / a.price;
      out.subAmount = (pct >= 0 ? '+' : '') + (pct * 100).toFixed(1).replace('.', ',') + '% к рыночной';
    }
  }
  else if (p.type === 'sell') {
    const a = CURS_DATA.asset(p.assetId);
    if (!a) return { title: 'Продажа', sub: 'выбери актив' };
    const qty = parseFloat(p.qty) || 0;
    const price = parseFloat(p.price) || 0;
    const rate = CURS_DATA.rateToBase(a.ccy);
    const proceeds = qty * price * rate;
    const h = holdings[a.id];
    const costBasis = h && h.qty > 0 ? (h.totalCostBase / h.qty) * qty : 0;
    const profit = proceeds - costBasis;
    const profitPct = costBasis > 0 ? profit / costBasis : 0;
    out.title = `Продать ${CURS_DATA.fmtQty(qty)} ${a.id}`;
    out.sub = `по ${CURS_DATA.fmtCcy(price, a.ccy, { decimals: price > 1000 ? 0 : 2 })}` +
              (a.price ? ' · текущая ' + CURS_DATA.fmtCcy(a.price, a.ccy, { decimals: a.price > 1000 ? 0 : 2 }) : '') +
              ' · в ' + p.cashAsset;
    out.amount = '+' + CURS_CHARTS.fmtMoneyCompact(proceeds) + ' ₽';
    out.amountLabel = 'Получим';
    out.amountTone = 'up';
    if (h && qty > h.qty) out.warn = 'превышение остатка';
    if (h && costBasis > 0) {
      out.profit = {
        value: (profit >= 0 ? '+' : '−') + CURS_CHARTS.fmtMoneyCompact(Math.abs(profit)) + ' ₽',
        sub: (profitPct >= 0 ? '+' : '') + (profitPct * 100).toFixed(1).replace('.', ',') + '% к покупке',
        tone: profit >= 0 ? 'up' : 'down',
      };
    }
  }
  else if (p.type === 'tx') {
    const aF = CURS_DATA.asset(p.fromAsset), aT = CURS_DATA.asset(p.toAsset);
    const qF = parseFloat(p.fromQty) || 0, qT = parseFloat(p.toQty) || 0;
    out.title = `${p.fromAsset} → ${p.toAsset}`;
    out.sub = `${CURS_DATA.fmtQty(qF)} ${p.fromAsset} → ${CURS_DATA.fmtQty(qT)} ${p.toAsset}`;
    const fromBase = aF ? qF * (aF.class === 'fiat' ? CURS_DATA.rateToBase(aF.ccy) : aF.price * CURS_DATA.rateToBase(aF.ccy)) : 0;
    out.amount = '≈ ' + CURS_CHARTS.fmtMoneyCompact(fromBase) + ' ₽';
    out.amountLabel = 'Объём';
    if (qF > 0 && qT > 0) out.rate = `1 ${p.toAsset} = ${CURS_DATA.fmtQty(qF / qT, qF/qT < 1 ? 6 : 2)} ${p.fromAsset}`;
  }
  else if (p.type === 'in' || p.type === 'out') {
    const a = CURS_DATA.asset(p.asset);
    const qty = parseFloat(p.qty) || 0;
    const rate = CURS_DATA.rateToBase(a.ccy);
    out.title = (p.type === 'in' ? 'Пополнение ' : 'Вывод ') + a.id;
    out.sub = CURS_DATA.fmtCcy(qty, a.ccy, { decimals: a.ccy === 'RUB' ? 0 : 2 });
    out.amount = (p.type === 'in' ? '+' : '−') + CURS_CHARTS.fmtMoneyCompact(qty * rate) + ' ₽';
    out.amountLabel = p.type === 'in' ? 'Вносим' : 'Снимаем';
    out.amountTone = p.type === 'in' ? 'up' : 'down';
  }
  else if (p.type === 'div') {
    const cashA = CURS_DATA.asset(p.cashAsset);
    const qty = parseFloat(p.qty) || 0;
    out.title = `Дивиденд · ${p.source || '—'}`;
    out.sub = CURS_DATA.fmtCcy(qty, cashA ? cashA.ccy : 'RUB', { decimals: cashA && cashA.ccy === 'RUB' ? 0 : 2 });
    out.amount = '+' + CURS_CHARTS.fmtMoneyCompact(qty * (cashA ? CURS_DATA.rateToBase(cashA.ccy) : 1)) + ' ₽';
    out.amountLabel = 'Поступит';
    out.amountTone = 'up';
  }
  return out;
}

// Aggregate stats from plans
function aggregatePlans(plans, holdings) {
  let buyCost = 0, buyCount = 0;
  let sellProceeds = 0, sellCost = 0, sellCount = 0;
  let inflow = 0, outflow = 0, divInflow = 0;
  const byPortfolio = {};

  plans.forEach(p => {
    const pf = p.portfolioId;
    if (!byPortfolio[pf]) byPortfolio[pf] = { in: 0, out: 0 };
    if (p.type === 'buy') {
      const a = CURS_DATA.asset(p.assetId); if (!a) return;
      const cost = (parseFloat(p.qty) || 0) * (parseFloat(p.price) || 0) * CURS_DATA.rateToBase(a.ccy);
      buyCost += cost; buyCount++;
      byPortfolio[pf].out += cost;
    } else if (p.type === 'sell') {
      const a = CURS_DATA.asset(p.assetId); if (!a) return;
      const qty = parseFloat(p.qty) || 0, price = parseFloat(p.price) || 0;
      const proceeds = qty * price * CURS_DATA.rateToBase(a.ccy);
      const h = holdings[a.id];
      const cb = h && h.qty > 0 ? (h.totalCostBase / h.qty) * qty : 0;
      sellProceeds += proceeds; sellCost += cb; sellCount++;
      byPortfolio[pf].in += proceeds;
    } else if (p.type === 'in') {
      const a = CURS_DATA.asset(p.asset); const q = parseFloat(p.qty) || 0;
      if (a) { const v = q * CURS_DATA.rateToBase(a.ccy); inflow += v; byPortfolio[pf].in += v; }
    } else if (p.type === 'out') {
      const a = CURS_DATA.asset(p.asset); const q = parseFloat(p.qty) || 0;
      if (a) { const v = q * CURS_DATA.rateToBase(a.ccy); outflow += v; byPortfolio[pf].out += v; }
    } else if (p.type === 'div') {
      const a = CURS_DATA.asset(p.cashAsset); const q = parseFloat(p.qty) || 0;
      if (a) { const v = q * CURS_DATA.rateToBase(a.ccy); divInflow += v; byPortfolio[pf].in += v; }
    }
    // tx: net 0 in cash flow terms
  });

  const netCashFlow = sellProceeds + inflow + divInflow - buyCost - outflow;
  const sellProfit = sellProceeds - sellCost;
  return { buyCost, buyCount, sellProceeds, sellCost, sellCount, sellProfit, inflow, outflow, divInflow, netCashFlow, byPortfolio };
}

// Convert plan → real transaction shape (matches CURS_DATA.TX entries)
function planToTx(p) {
  const d = new Date(p.date + 'T12:00:00Z');
  const id = newTxId();
  const portfolio = p.portfolioId;
  if (p.type === 'buy')  return { id, type: 'tx', portfolio, d, from: { asset: p.cashAsset, qty: (parseFloat(p.qty) || 0) * (parseFloat(p.price) || 0) }, to: { asset: p.assetId, qty: parseFloat(p.qty) || 0 } };
  if (p.type === 'sell') return { id, type: 'tx', portfolio, d, from: { asset: p.assetId, qty: parseFloat(p.qty) || 0 }, to: { asset: p.cashAsset, qty: (parseFloat(p.qty) || 0) * (parseFloat(p.price) || 0) } };
  if (p.type === 'tx')   return { id, type: 'tx', portfolio, d, from: { asset: p.fromAsset, qty: parseFloat(p.fromQty) || 0 }, to: { asset: p.toAsset, qty: parseFloat(p.toQty) || 0 } };
  if (p.type === 'in')   return { id, type: 'in', portfolio, d, asset: p.asset, qty: parseFloat(p.qty) || 0 };
  if (p.type === 'out')  return { id, type: 'out', portfolio, d, asset: p.asset, qty: parseFloat(p.qty) || 0 };
  if (p.type === 'div')  return { id, type: 'div', portfolio, d, source: p.source, cashAsset: p.cashAsset, qty: parseFloat(p.qty) || 0 };
  return null;
}

function pluralPlans(n) {
  if (n % 10 === 1 && n % 100 !== 11) return 'сделка';
  if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return 'сделки';
  return 'сделок';
}
function fmtDateShort(s) {
  if (!s) return '';
  const d = new Date(s);
  const months = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
  return d.getDate() + ' ' + months[d.getMonth()];
}
function round(v, ref) {
  if (ref > 1000) return Math.round(v);
  if (ref > 100) return Math.round(v * 10) / 10;
  return Math.round(v * 100) / 100;
}
function roundQty(v, asset) {
  if (asset && asset.class === 'crypto') return Math.round(v * 100000) / 100000;
  if (v >= 10) return Math.round(v);
  return Math.round(v * 1000) / 1000;
}

window.CURS_CALC = { CalcScreen };
