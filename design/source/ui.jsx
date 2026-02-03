// CURS — UI primitives & icons (simplified)
const { useState: cuUseState, useEffect: cuUseEffect } = React;

// ============================================
// Icons
// ============================================
const I = {
  home:      (p={}) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-6h-6v6H5a2 2 0 0 1-2-2z"/></svg>,
  briefcase: (p={}) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/></svg>,
  chart:     (p={}) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 3v18h18"/><path d="M7 14l4-4 4 3 5-7"/></svg>,
  calc:      (p={}) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h3M14 15h2M8 19h3M14 19h2"/></svg>,
  settings:  (p={}) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.86l.06.07a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.07a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.07a1.7 1.7 0 0 0 1.55-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h0a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.07a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v0a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.07a1.7 1.7 0 0 0-1.55 1z"/></svg>,
  search:    (p={}) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5"/></svg>,
  plus:      (p={}) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 5v14M5 12h14"/></svg>,
  arrow_right:(p={})=> <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12h14M13 5l7 7-7 7"/></svg>,
  close:     (p={}) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M18 6L6 18M6 6l12 12"/></svg>,
  eye:       (p={}) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>,
  eye_off:   (p={}) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-6.4 0-10-7-10-7a18.7 18.7 0 0 1 4.06-5.06M9.9 4.24A10.9 10.9 0 0 1 12 4c6.4 0 10 7 10 7a18.5 18.5 0 0 1-2.16 2.94M14.12 14.12a3 3 0 1 1-4.24-4.24M2 2l20 20"/></svg>,
  swap:      (p={}) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M7 4l-4 4 4 4M3 8h14M17 20l4-4-4-4M21 16H7"/></svg>,
  arrow_in:  (p={}) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 4v12M6 10l6 6 6-6M4 20h16"/></svg>,
  arrow_out: (p={}) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 20V8M6 14l6-6 6 6M4 4h16"/></svg>,
  coin:      (p={}) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9"/><path d="M9 9.5a3 3 0 0 1 5.5 1.5c0 1.5-1 2-2 2.5s-2 1-2 2.5"/><circle cx="12" cy="18.2" r=".7" fill="currentColor"/></svg>,
};

// ============================================
// Sidebar — simple: Обзор / portfolios / Аналитика
// ============================================
function Sidebar({ route, setRoute, portfolios, activePortfolio, setActivePortfolio, onAdd }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="mark">C</div>
        <div className="name">CURS</div>
      </div>

      <nav className="nav">
        <NavItem icon={I.home()} label="Обзор" active={route === 'dashboard'} onClick={() => setRoute('dashboard')} />
        <NavItem icon={I.chart()} label="Аналитика" active={route === 'analytics'} onClick={() => setRoute('analytics')} />
        <NavItem icon={I.calc()} label="Планировщик" active={route === 'calc'} onClick={() => setRoute('calc')} />
        <NavItem icon={I.settings()} label="Настройки" active={route === 'settings'} onClick={() => setRoute('settings')} />

        <div className="nav-section">
          <span>Портфели</span>
          <button className="nav-section-add" onClick={() => onAdd('portfolio')} title="Новый портфель">{I.plus({width:11,height:11})}</button>
        </div>
        {portfolios.map(p => (
          <NavPortfolio key={p.id} portfolio={p}
            active={route === 'portfolio' && activePortfolio === p.id}
            onClick={() => { setRoute('portfolio'); setActivePortfolio(p.id); }} />
        ))}
      </nav>

      <div className="footer">
        <button className="btn primary" style={{width:'100%', justifyContent:'center'}} onClick={() => onAdd('tx')}>
          {I.plus()}<span>Сделка</span>
        </button>
        <div className="user-card">
          <div className="ava">МР</div>
          <div className="who">
            Максим Родиков
            <small>maxim@curs.local</small>
          </div>
        </div>
      </div>
    </aside>
  );
}

function NavItem({ icon, label, count, active, onClick }) {
  return (
    <div className={'nav-item ' + (active ? 'active' : '')} onClick={onClick}>
      <span className="ic">{icon}</span>
      {label}
      {count != null && <span className="count">{count}</span>}
    </div>
  );
}

function NavPortfolio({ portfolio, active, onClick }) {
  const pv = CURS_DATA.portfolioValue(portfolio);
  return (
    <div className={'nav-item nav-portfolio ' + (active ? 'active' : '')} onClick={onClick}>
      <span className="dot" style={{background: portfolio.color}}></span>
      <span style={{flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{portfolio.name}</span>
      <span className="count mask">{CURS_CHARTS.fmtMoneyCompact(pv.total)}</span>
    </div>
  );
}

// ============================================
// TopBar
// ============================================
function TopBar({ crumbs, privacy, setPrivacy, onAddTx }) {
  return (
    <div className="topbar">
      <div className="crumbs">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="sep">/</span>}
            <span className={i === crumbs.length - 1 ? 'here' : ''}>{c}</span>
          </React.Fragment>
        ))}
      </div>

      <div className="actions">
        <button className="btn icon ghost" title={privacy ? 'Показать суммы' : 'Скрыть суммы'} onClick={() => setPrivacy(!privacy)}>
          {privacy ? I.eye_off() : I.eye()}
        </button>
        <button className="btn primary" onClick={onAddTx}>{I.plus()}<span>Сделка</span></button>
      </div>
    </div>
  );
}

// ============================================
// Asset icon — uses asset.icon for color class
// ============================================
function AssetIcon({ asset, size = 28 }) {
  const label = asset.id === 'OFZ26240' ? 'ОФЗ' : asset.id.slice(0, 4);
  return (
    <div className={'icon ' + (asset.icon || 'a-default')}
         style={{ width: size, height: size, fontSize: size > 32 ? 12 : size > 26 ? 11 : 10 }}>
      {label}
    </div>
  );
}

// ============================================
// Class chip
// ============================================
function ClassChip({ cls, small }) {
  return (
    <span className="class-chip" data-class={cls} style={small ? {fontSize: 10, padding: '1px 6px'} : {}}>
      <span className="dot" style={{background: CURS_DATA.CLASS_COLOR[cls]}}></span>
      {CURS_DATA.CLASS_LABEL[cls]}
    </span>
  );
}

// ============================================
// Range tabs (for analytics)
// ============================================
function RangeTabs({ value, onChange, options = ['1Н','1М','3М','1Г','Всё'] }) {
  return (
    <div className="range-tabs">
      {options.map(o => (
        <div key={o} className={'range-tab ' + (value === o ? 'active':'')} onClick={() => onChange(o)}>{o}</div>
      ))}
    </div>
  );
}
const RANGE_DAYS = { '1Д': 2, '1Н': 7, '1М': 31, '3М': 92, '1Г': 365, 'Всё': 365 };

// ============================================
// Percent delta
// ============================================
function PercentDelta({ value, abs }) {
  const positive = value >= 0;
  return (
    <span className={'mono ' + (positive ? 'delta up' : 'delta down')} style={{fontWeight: 600}}>
      {positive ? '▲' : '▼'} {(Math.abs(value) * 100).toFixed(2).replace('.', ',')}%
      {abs != null && (
        <span style={{fontWeight: 500, marginLeft: 6}}>
          {positive ? '+' : '−'}{CURS_CHARTS.fmtMoneyCompact(Math.abs(abs))}&nbsp;₽
        </span>
      )}
    </span>
  );
}

// ============================================
// Section header
// ============================================
function SectionHeader({ title, sub, right }) {
  return (
    <div className="row between" style={{marginBottom: 14, alignItems: 'flex-end'}}>
      <div>
        <div className="section-title lg">{title}{sub && <span className="sub">{sub}</span>}</div>
      </div>
      {right && <div className="row gap-sm">{right}</div>}
    </div>
  );
}

// ============================================
// Modal shell
// ============================================
function Modal({ open, onClose, title, sub, children, footer, width = 480 }) {
  cuUseEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{width}} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="col" style={{gap: 2, flex: 1, minWidth: 0}}>
            <div className="modal-title">{title}</div>
            {sub && <div className="mini">{sub}</div>}
          </div>
          <button className="btn icon ghost" onClick={onClose}>{I.close()}</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

window.CURS_UI = { I, Sidebar, TopBar, AssetIcon, ClassChip, RangeTabs, RANGE_DAYS, PercentDelta, SectionHeader, Modal };
