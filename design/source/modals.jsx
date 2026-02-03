// CURS — Modals: Add Asset, Add Transaction
const { useState: mdUseState, useMemo: mdUseMemo, useEffect: mdUseEffect } = React;

// ============================================
// Add Asset modal
// Pick class → fill basic fields → "add"
// ============================================
function AddAssetModal({ open, portfolio, onClose }) {
  const [cls, setCls] = mdUseState('tradfi');
  const [ticker, setTicker] = mdUseState('');
  const [name, setName] = mdUseState('');
  const [ccy, setCcy] = mdUseState('RUB');
  const [price, setPrice] = mdUseState('');
  const [sub, setSub] = mdUseState('Акция');

  mdUseEffect(() => {
    if (!open) return;
    setTicker(''); setName(''); setPrice('');
    setCls('tradfi'); setCcy('RUB'); setSub('Акция');
  }, [open]);

  if (!open) return null;

  const classOpts = [
    { key: 'tradfi', label: 'Трад. финансы', sub: 'Акции, облигации, ETF' },
    { key: 'crypto', label: 'Крипта',        sub: 'BTC, ETH и другие токены' },
    { key: 'fiat',   label: 'Валюта',        sub: 'RUB, USD, EUR, …' },
  ];
  const subOpts = cls === 'tradfi' ? ['Акция', 'Облигация', 'ETF', 'Фонд'] : null;
  const ccyOpts = cls === 'fiat' ? ['USD', 'EUR', 'CNY', 'AED'] : ['RUB', 'USD', 'EUR'];

  const canSubmit = ticker.trim() && (cls === 'fiat' || price);

  return (
    <CURS_UI.Modal open={open} onClose={onClose}
      title="Добавить актив"
      sub={portfolio ? <>В портфель <strong style={{color:'var(--ink)'}}>{portfolio.name}</strong></> : 'Будет доступен во всех портфелях'}
      width={520}
      footer={
        <>
          <button className="btn" onClick={onClose}>Отмена</button>
          <button className="btn primary" disabled={!canSubmit} onClick={onClose}>Добавить актив</button>
        </>
      }
    >
      {/* Class picker */}
      <Field label="Класс активa">
        <div className="seg-list">
          {classOpts.map(o => (
            <button key={o.key} className={'seg-card ' + (cls === o.key ? 'active' : '')} onClick={() => {
              setCls(o.key);
              if (o.key === 'fiat') { setCcy('USD'); setSub(''); }
              if (o.key === 'crypto') { setCcy('USD'); setSub(''); }
              if (o.key === 'tradfi') { setCcy('RUB'); setSub('Акция'); }
            }}>
              <span className="dot" style={{background: CURS_DATA.CLASS_COLOR[o.key]}}></span>
              <div className="col" style={{gap: 2, alignItems: 'flex-start'}}>
                <span style={{fontWeight: 600, fontSize: 13}}>{o.label}</span>
                <span className="mini" style={{textAlign: 'left'}}>{o.sub}</span>
              </div>
            </button>
          ))}
        </div>
      </Field>

      <div className="grid grid-2" style={{gap: 12}}>
        <Field label={cls === 'fiat' ? 'Код валюты' : 'Тикер'}>
          <input className="inp" placeholder={cls === 'fiat' ? 'USD' : cls === 'crypto' ? 'BTC' : 'SBER'}
                 value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} maxLength={8} />
        </Field>
        <Field label="Название">
          <input className="inp" placeholder={cls === 'fiat' ? 'Доллар США' : 'Полное название'}
                 value={name} onChange={e => setName(e.target.value)} />
        </Field>
      </div>

      {cls === 'tradfi' && (
        <Field label="Подкласс">
          <Pills value={sub} onChange={setSub} options={subOpts} />
        </Field>
      )}

      <div className="grid grid-2" style={{gap: 12}}>
        {cls !== 'fiat' && (
          <Field label="Валюта торгов">
            <Pills value={ccy} onChange={setCcy} options={ccyOpts} />
          </Field>
        )}
        <Field label={cls === 'fiat' ? 'Курс к ₽' : 'Текущая цена'}>
          <div className="inp-row">
            <input className="inp" type="number" placeholder="0,00" value={price} onChange={e => setPrice(e.target.value)} />
            <span className="inp-suffix">{cls === 'fiat' ? '₽' : (ccy === 'RUB' ? '₽' : ccy === 'USD' ? '$' : '€')}</span>
          </div>
        </Field>
      </div>

      <div className="hint">
        Это только запись актива в каталог. Чтобы добавить количество в портфель — создайте сделку «Транзакция» или «Пополнение».
      </div>
    </CURS_UI.Modal>
  );
}

// ============================================
// Add Transaction modal
// 4 types: in, out, tx, div
// ============================================
function AddTxModal({ open, portfolio, allPortfolios, onClose }) {
  const [type, setType] = mdUseState('tx');
  const [portfolioId, setPortfolioId] = mdUseState(portfolio ? portfolio.id : (allPortfolios[0] && allPortfolios[0].id));
  const [date, setDate] = mdUseState(toISODate(new Date()));

  // type-specific fields
  const [asset, setAsset] = mdUseState('RUB');         // for in/out
  const [qty, setQty] = mdUseState('');

  const [fromAsset, setFromAsset] = mdUseState('RUB'); // for tx
  const [fromQty, setFromQty]     = mdUseState('');
  const [toAsset, setToAsset]     = mdUseState('SBER');
  const [toQty, setToQty]         = mdUseState('');

  const [divSource, setDivSource]    = mdUseState('SBER'); // for div
  const [divCashAsset, setDivCashAsset] = mdUseState('RUB');
  const [divQty, setDivQty]          = mdUseState('');

  mdUseEffect(() => {
    if (!open) return;
    setType('tx');
    setPortfolioId(portfolio ? portfolio.id : (allPortfolios[0] && allPortfolios[0].id));
    setDate(toISODate(new Date()));
    setQty(''); setFromQty(''); setToQty(''); setDivQty('');
  }, [open, portfolio]);

  if (!open) return null;

  // Helpers
  const fiats   = CURS_DATA.ASSETS.filter(a => a.class === 'fiat');
  const nonFiat = CURS_DATA.ASSETS.filter(a => a.class !== 'fiat');
  const dividendable = CURS_DATA.ASSETS.filter(a => a.class === 'tradfi' || a.class === 'crypto');

  const typeOpts = [
    { key: 'tx',  label: 'Транзакция', sub: 'Покупка/продажа одного за другой' },
    { key: 'in',  label: 'Пополнение', sub: 'Внести валюту в портфель' },
    { key: 'out', label: 'Вывод',      sub: 'Снять валюту с портфеля' },
    { key: 'div', label: 'Дивиденд',   sub: 'Выплата от актива' },
  ];

  // Validation
  const canSubmit =
    type === 'in'  ? qty > 0 :
    type === 'out' ? qty > 0 :
    type === 'tx'  ? fromAsset !== toAsset && fromQty > 0 && toQty > 0 :
    type === 'div' ? divQty > 0 :
    false;

  return (
    <CURS_UI.Modal open={open} onClose={onClose}
      title="Новая сделка"
      sub={null}
      width={560}
      footer={
        <>
          <button className="btn" onClick={onClose}>Отмена</button>
          <button className="btn primary" disabled={!canSubmit} onClick={onClose}>Добавить</button>
        </>
      }
    >
      {/* Type tabs */}
      <Field label="Тип">
        <div className="seg-list seg-list-4">
          {typeOpts.map(o => {
            const meta = CURS_PORTFOLIO.txMeta(o.key);
            return (
              <button key={o.key} className={'seg-card ' + (type === o.key ? 'active' : '')} onClick={() => setType(o.key)}>
                <span className="seg-icon" style={{background: meta.bg, color: meta.color}}>{meta.icon}</span>
                <div className="col" style={{gap: 2, alignItems: 'flex-start'}}>
                  <span style={{fontWeight: 600, fontSize: 13}}>{o.label}</span>
                  <span className="mini" style={{textAlign: 'left'}}>{o.sub}</span>
                </div>
              </button>
            );
          })}
        </div>
      </Field>

      {/* Portfolio + date — common */}
      <div className="grid grid-2" style={{gap: 12}}>
        <Field label="Портфель">
          <select className="inp" value={portfolioId} onChange={e => setPortfolioId(e.target.value)}>
            {allPortfolios.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Дата">
          <input className="inp" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </Field>
      </div>

      {/* Type-specific body */}
      {type === 'in' && (
        <TxInOut asset={asset} setAsset={setAsset} qty={qty} setQty={setQty} options={fiats} label="Вносится" />
      )}
      {type === 'out' && (
        <TxInOut asset={asset} setAsset={setAsset} qty={qty} setQty={setQty} options={fiats} label="Снимается" />
      )}
      {type === 'tx' && (
        <TxSwap
          fromAsset={fromAsset} setFromAsset={setFromAsset} fromQty={fromQty} setFromQty={setFromQty}
          toAsset={toAsset}     setToAsset={setToAsset}     toQty={toQty}     setToQty={setToQty}
        />
      )}
      {type === 'div' && (
        <TxDiv
          divSource={divSource} setDivSource={setDivSource}
          divCashAsset={divCashAsset} setDivCashAsset={setDivCashAsset}
          divQty={divQty} setDivQty={setDivQty}
          sourceOpts={dividendable} cashOpts={fiats}
        />
      )}
    </CURS_UI.Modal>
  );
}

// --- Sub-bodies -------------------------------------------------------

function TxInOut({ asset, setAsset, qty, setQty, options, label }) {
  return (
    <Field label={label}>
      <div className="inp-row">
        <select className="inp inp-asset" value={asset} onChange={e => setAsset(e.target.value)}>
          {options.map(a => <option key={a.id} value={a.id}>{a.id} · {a.name}</option>)}
        </select>
        <input className="inp" type="number" placeholder="0" value={qty} onChange={e => setQty(e.target.value)} />
      </div>
    </Field>
  );
}

function TxSwap({ fromAsset, setFromAsset, fromQty, setFromQty, toAsset, setToAsset, toQty, setToQty }) {
  const allAssets = CURS_DATA.ASSETS;
  // Suggest rate
  const fromA = CURS_DATA.asset(fromAsset);
  const toA   = CURS_DATA.asset(toAsset);
  function valueBase(id, q) {
    if (!q) return 0;
    return CURS_DATA.valueInBase(id, parseFloat(q));
  }
  const ratio = parseFloat(fromQty) > 0 && parseFloat(toQty) > 0
    ? (valueBase(fromAsset, fromQty) / valueBase(toAsset, toQty))
    : null;

  function swap() {
    setFromAsset(toAsset); setToAsset(fromAsset);
    setFromQty(toQty);     setToQty(fromQty);
  }

  return (
    <>
      <Field label="Отдаём">
        <AssetQtyRow asset={fromAsset} setAsset={setFromAsset} qty={fromQty} setQty={setFromQty} options={allAssets} tone="down" />
      </Field>

      <div style={{position: 'relative', height: 8}}>
        <button className="swap-btn" onClick={swap} title="Поменять местами">{CURS_UI.I.swap()}</button>
      </div>

      <Field label="Получаем">
        <AssetQtyRow asset={toAsset} setAsset={setToAsset} qty={toQty} setQty={setToQty} options={allAssets} tone="up" />
      </Field>

      {ratio && fromAsset !== toAsset && (
        <div className="hint">
          Курс сделки: <strong style={{color:'var(--ink)'}}>1 {toA.id} = {CURS_DATA.fmtQty(ratio, ratio < 1 ? 6 : 2)} {fromA.id}</strong>
          {' · '}
          ≈&nbsp;{CURS_CHARTS.fmtMoneyCompact(valueBase(fromAsset, fromQty))}&nbsp;₽
        </div>
      )}
    </>
  );
}

function TxDiv({ divSource, setDivSource, divCashAsset, setDivCashAsset, divQty, setDivQty, sourceOpts, cashOpts }) {
  return (
    <>
      <div className="grid grid-2" style={{gap: 12}}>
        <Field label="Источник (актив)">
          <select className="inp" value={divSource} onChange={e => setDivSource(e.target.value)}>
            {sourceOpts.map(a => <option key={a.id} value={a.id}>{a.id} · {a.name}</option>)}
          </select>
        </Field>
        <Field label="Валюта выплаты">
          <select className="inp" value={divCashAsset} onChange={e => setDivCashAsset(e.target.value)}>
            {cashOpts.map(a => <option key={a.id} value={a.id}>{a.id} · {a.name}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Сумма">
        <div className="inp-row">
          <input className="inp" type="number" placeholder="0" value={divQty} onChange={e => setDivQty(e.target.value)} />
          <span className="inp-suffix">{divCashAsset}</span>
        </div>
      </Field>
    </>
  );
}

// --- Small parts ------------------------------------------------------

function Field({ label, children }) {
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      {children}
    </div>
  );
}

function Pills({ value, onChange, options }) {
  return (
    <div className="pills">
      {options.map(o => (
        <button key={o} className={'pill-btn ' + (value === o ? 'active' : '')} onClick={() => onChange(o)}>{o}</button>
      ))}
    </div>
  );
}

function AssetQtyRow({ asset, setAsset, qty, setQty, options, tone }) {
  // Group options by class for nicer dropdown
  const groups = [
    ['fiat',   'Валюты',        options.filter(o => o.class === 'fiat')],
    ['tradfi', 'Трад. финансы', options.filter(o => o.class === 'tradfi')],
    ['crypto', 'Крипта',        options.filter(o => o.class === 'crypto')],
  ];
  const a = CURS_DATA.asset(asset);
  return (
    <div className="inp-row">
      <select className="inp inp-asset" value={asset} onChange={e => setAsset(e.target.value)}>
        {groups.map(([k, label, arr]) => arr.length ? (
          <optgroup key={k} label={label}>
            {arr.map(o => <option key={o.id} value={o.id}>{o.id} · {o.name}</option>)}
          </optgroup>
        ) : null)}
      </select>
      <input className="inp" type="number" placeholder="0" value={qty} onChange={e => setQty(e.target.value)} />
      <span className="inp-suffix" data-tone={tone}>{a ? a.id : ''}</span>
    </div>
  );
}

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

window.CURS_MODALS = { AddAssetModal, AddTxModal };
