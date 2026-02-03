// CURS — Settings screen (пароль + источники цен)
const { useState: stUseState } = React;

function SettingsScreen() {
  return (
    <div className="content" style={{maxWidth: 880}}>
      <div className="page-head">
        <div>
          <div className="title">Настройки</div>
          <div className="sub">Безопасность и источники рыночных данных</div>
        </div>
      </div>

      <SecurityCard />
      <div style={{height: 22}}></div>
      <SourcesCard />
    </div>
  );
}

// ============================================
// Смена пароля
// ============================================
function SecurityCard() {
  const [cur, setCur] = stUseState('');
  const [pw, setPw]   = stUseState('');
  const [pw2, setPw2] = stUseState('');
  const [show, setShow] = stUseState(false);
  const [saved, setSaved] = stUseState(false);

  const strength = scorePw(pw);
  const match = pw && pw2 && pw === pw2;
  const canSave = cur.length >= 6 && pw.length >= 8 && match;

  function submit() {
    if (!canSave) return;
    setSaved(true);
    setCur(''); setPw(''); setPw2('');
    setTimeout(() => setSaved(false), 2400);
  }

  return (
    <div className="card">
      <div className="row between" style={{marginBottom: 18, alignItems: 'flex-start'}}>
        <div className="col" style={{gap: 4}}>
          <h3 className="section-title lg">Смена пароля</h3>
          <div className="mini">Минимум 8 символов · буквы и цифры</div>
        </div>
      </div>

      <div className="grid grid-2" style={{gap: 14, marginBottom: 14}}>
        <div className="field">
          <div className="field-label">Текущий пароль</div>
          <div className="inp-row">
            <input className="inp" type={show ? 'text' : 'password'} value={cur} onChange={e => setCur(e.target.value)} autoComplete="current-password" />
            <button className="inp-suffix" style={{cursor: 'pointer', borderLeft: '1px solid var(--hairline-2)'}} onClick={() => setShow(s => !s)} type="button">
              {show ? CURS_UI.I.eye_off() : CURS_UI.I.eye()}
            </button>
          </div>
        </div>
        <div></div>

        <div className="field">
          <div className="field-label">Новый пароль</div>
          <input className="inp" type={show ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" />
          <PwStrength score={strength} />
        </div>
        <div className="field">
          <div className="field-label">Подтвердите</div>
          <input className="inp" type={show ? 'text' : 'password'} value={pw2} onChange={e => setPw2(e.target.value)} autoComplete="new-password" />
          {pw2 && (
            <div className="mini" style={{color: match ? 'var(--up)' : 'var(--down)', fontWeight: 500}}>
              {match ? '✓ совпадает' : '⨯ пароли не совпадают'}
            </div>
          )}
        </div>
      </div>

      <div className="row between" style={{marginTop: 18, alignItems: 'center'}}>
        <span className="mini" style={{color: saved ? 'var(--up)' : 'var(--ink-3)'}}>
          {saved ? '✓ Пароль обновлён' : 'Последняя смена: 14 марта 2026'}
        </span>
        <button className="btn primary" disabled={!canSave} onClick={submit}>Сохранить пароль</button>
      </div>
    </div>
  );
}

function PwStrength({ score }) {
  // 0..4
  const labels = ['', 'слабый', 'средний', 'хороший', 'надёжный'];
  const colors = ['var(--surface-3)', 'var(--down)', 'var(--warn)', 'var(--up)', 'var(--up)'];
  return (
    <div className="row gap-sm" style={{marginTop: 4, height: 14}}>
      <div className="row" style={{flex: 1, gap: 3}}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: i < score ? colors[score] : 'var(--surface-3)',
            transition: 'background .15s',
          }}></div>
        ))}
      </div>
      <span className="mini" style={{color: colors[score], fontWeight: 500, minWidth: 70, textAlign: 'right'}}>{labels[score]}</span>
    </div>
  );
}

function scorePw(p) {
  if (!p) return 0;
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-ZА-Я]/.test(p) && /[a-zа-я]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^\w\sа-яА-Я]/.test(p) || p.length >= 14) s++;
  return Math.min(4, s);
}

// ============================================
// Источники цен — API провайдеров
// ============================================
const PROVIDERS = [
  {
    id: 'moex', name: 'Московская биржа', short: 'MOEX',
    sub: 'Акции, облигации, ETF (Россия)',
    classes: ['tradfi'],
    docs: 'iss.moex.com/iss/reference',
    fields: [
      { key: 'baseUrl', label: 'Endpoint', value: 'https://iss.moex.com/iss', readonly: true },
      { key: 'token',   label: 'Токен (опционально)', placeholder: 'Для расширенных лимитов' },
    ],
    hint: 'ISS API публичный, токен нужен только для повышенных квот.',
    free: true,
  },
  {
    id: 'coingecko', name: 'CoinGecko', short: 'CG',
    sub: 'Крипта: BTC, ETH и 10 000+ токенов',
    classes: ['crypto'],
    docs: 'docs.coingecko.com',
    fields: [
      { key: 'apiKey', label: 'API ключ', placeholder: 'CG-xxxxxx (для Pro плана)' },
      { key: 'plan',   label: 'План', type: 'select', options: ['Demo (бесплатно)', 'Analyst', 'Pro', 'Enterprise'] },
    ],
    hint: 'Без ключа доступен Demo-план: 30 запросов/мин.',
    free: true,
  },
];

function SourcesCard() {
  const [conns, setConns] = stUseState({
    moex:      { connected: true,  fields: { baseUrl: 'https://iss.moex.com/iss', token: '' } },
    coingecko: { connected: false, fields: { apiKey: '', plan: 'Demo (бесплатно)' } },
  });

  return (
    <div className="card">
      <div className="row between" style={{marginBottom: 18, alignItems: 'flex-start'}}>
        <div className="col" style={{gap: 4}}>
          <h3 className="section-title lg">Источники рыночных данных</h3>
          <div className="mini">API для подгрузки актуальных котировок</div>
        </div>
      </div>

      <div className="col" style={{gap: 14}}>
        {PROVIDERS.map(prov => (
          <Provider key={prov.id} prov={prov}
            state={conns[prov.id]}
            onToggle={() => setConns(c => ({ ...c, [prov.id]: { ...c[prov.id], connected: !c[prov.id].connected } }))}
            onFieldChange={(k, v) => setConns(c => ({ ...c, [prov.id]: { ...c[prov.id], fields: { ...c[prov.id].fields, [k]: v } } }))}
          />
        ))}
      </div>

      <div className="hint" style={{marginTop: 14}}>
        Для валют курс ЦБ РФ подгружается автоматически — отдельного источника не требуется.
      </div>
    </div>
  );
}

function Provider({ prov, state, onToggle, onFieldChange }) {
  const [expanded, setExpanded] = stUseState(false);
  const [testing, setTesting] = stUseState(null); // null | 'pending' | 'ok' | 'fail'

  function test() {
    setTesting('pending');
    setTimeout(() => setTesting('ok'), 800);
  }

  return (
    <div className={'provider ' + (state.connected ? 'connected' : '')}>
      <div className="row between provider-head" style={{alignItems: 'center', gap: 14}}>
        <div className="row gap-md" style={{flex: 1, minWidth: 0}}>
          <div className="provider-mark" data-prov={prov.id}>{prov.short}</div>
          <div className="col" style={{gap: 2, flex: 1, minWidth: 0}}>
            <div className="row gap-sm" style={{alignItems: 'baseline'}}>
              <span style={{fontSize: 15, fontWeight: 600}}>{prov.name}</span>
              {prov.classes.map(c => <CURS_UI.ClassChip key={c} cls={c} small />)}
              {prov.free && <span className="pill ghost" style={{height: 18, fontSize: 10}}>бесплатно</span>}
            </div>
            <span className="mini">{prov.sub} · <span style={{fontFamily: 'var(--mono)'}}>{prov.docs}</span></span>
          </div>
        </div>
        <div className="row gap-sm">
          <span className={'status-dot ' + (state.connected ? 'on' : 'off')}>
            <span></span>{state.connected ? 'подключено' : 'не подключено'}
          </span>
          <button className="btn sm" onClick={() => setExpanded(e => !e)}>
            {expanded ? 'Скрыть' : 'Настроить'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="provider-body">
          <div className="grid grid-2" style={{gap: 12}}>
            {prov.fields.map(f => (
              <div key={f.key} className="field" style={f.key === 'baseUrl' ? {gridColumn: '1 / -1'} : {}}>
                <div className="field-label">{f.label}</div>
                {f.type === 'select' ? (
                  <select className="inp" value={state.fields[f.key]} onChange={e => onFieldChange(f.key, e.target.value)}>
                    {f.options.map(o => <option key={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    className="inp"
                    placeholder={f.placeholder || ''}
                    value={state.fields[f.key]}
                    readOnly={f.readonly}
                    onChange={e => onFieldChange(f.key, e.target.value)}
                    style={f.readonly ? {color: 'var(--ink-3)', background: 'var(--surface-2)'} : {}}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="hint" style={{marginTop: 10}}>{prov.hint}</div>

          <div className="row between" style={{marginTop: 14}}>
            <button className="btn sm" onClick={test}>
              {testing === 'pending' ? 'Проверяю…' : 'Проверить соединение'}
            </button>
            {testing === 'ok' && <span className="mini" style={{color: 'var(--up)', fontWeight: 500}}>✓ Соединение установлено · 142 мс</span>}
            <button className={'btn sm ' + (state.connected ? '' : 'primary')} onClick={onToggle}>
              {state.connected ? 'Отключить' : 'Подключить'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

window.CURS_SETTINGS = { SettingsScreen };
