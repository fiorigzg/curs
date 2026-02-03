// CURS — Landing page
const { useState: lUseState, useEffect: lUseEffect, useRef: lUseRef } = React;

const LANDING_TWEAKS = /*EDITMODE-BEGIN*/{
  "palette": "cream",
  "voice": "editorial",
  "energy": "lively"
}/*EDITMODE-END*/;

// ============================================
// Community widget catalog (sample)
// ============================================
const COMMUNITY_WIDGETS = [
  { id: 'monthly-returns', title: 'Месячная доходность',  cat: 'Анализ',     author: '@returns_ru',  installs: 1450, color: '#EE7544', glyph: '▤', desc: 'Heatmap по месяцам — где у портфеля стабильные периоды, а где провалы.' },
  { id: 'corr-pairs',      title: 'Лучшие диверсификаторы', cat: 'Корреляции', author: '@diversify',   installs: 910,  color: '#1F8F6F', glyph: '⇋', desc: 'Топ пар с самой низкой корреляцией — что добавить, чтобы снизить риск.' },
  { id: 'kelly',           title: 'Критерий Келли',        cat: 'Расчёт',     author: '@bet_size',    installs: 720,  color: '#8C5BD7', glyph: 'K', desc: 'Оптимальная доля для каждой позиции по формуле Келли.' },
  { id: 'tax-rus',         title: 'Налоги РФ',            cat: 'Налоги',      author: '@taxhelper',   installs: 2230, color: '#C0392B', glyph: '₽', desc: 'Реализованный P&L по закрытым сделкам с учётом ЛДВ-льготы 3 года.' },
  { id: 'div-cal',         title: 'Дивидендный календарь', cat: 'Доходы',     author: '@cashflow_ru', installs: 3120, color: '#B58300', glyph: '◆', desc: 'Ближайшие выплаты по портфелю и накопленный годовой доход.' },
  { id: 'rebalance',       title: 'Ребалансировка',       cat: 'Стратегии',   author: '@balance',     installs: 1840, color: '#4F6BED', glyph: '⚖', desc: 'Целевые доли и список сделок, чтобы вернуться к плану.' },
  { id: 'goals',           title: 'Финансовые цели',      cat: 'Планирование', author: '@goals_app',  installs: 4870, color: '#1F8A4F', glyph: '🎯', desc: 'Сколько до квартиры, пенсии и подушки безопасности по текущей траектории.' },
  { id: 'alerts',          title: 'Алерты на цены',       cat: 'Уведомления', author: '@watchlist',   installs: 2640, color: '#15140F', glyph: '!', desc: 'Правила вида «BTC > 100k» и «доля крипты > 30%» — со сводкой сработавших.' },
  { id: 'monte-mc',        title: 'Stress Test',          cat: 'Риск',       author: '@blackswan',   installs: 530,  color: '#2F4858', glyph: '↘', desc: 'Симуляция шоков 2008/2020/COVID — как пережил бы портфель.' },
  { id: 'cycles',          title: 'Циклы крипты',         cat: 'Крипта',     author: '@btc_cycles',  installs: 1190, color: '#EE7544', glyph: '◯', desc: 'Halving-циклы BTC, ваши покупки относительно средней цикла.' },
];

const CATS = ['Все', 'Анализ', 'Расчёт', 'Стратегии', 'Доходы', 'Налоги', 'Уведомления'];

// ============================================
// Root
// ============================================
function LandingApp() {
  const [submitOpen, setSubmitOpen] = lUseState(false);
  const [t, setTweak] = useTweaks(LANDING_TWEAKS);

  lUseEffect(() => {
    document.documentElement.dataset.palette = t.palette;
    document.documentElement.dataset.voice   = t.voice;
    document.documentElement.dataset.energy  = t.energy;
  }, [t.palette, t.voice, t.energy]);

  return (
    <>
      <Nav onCta={() => window.location.href = 'CURS Portfolio Tracker.html'} />
      <Hero />
      <Marquee />
      <Features />
      <ProductShowcase />
      <PlannerSection />
      <CommunitySection onSubmit={() => setSubmitOpen(true)} />
      <Cta onCta={() => window.location.href = 'CURS Portfolio Tracker.html'} />
      <Footer />
      {submitOpen && <SubmitModal onClose={() => setSubmitOpen(false)} />}

      <TweaksPanel title="Настроение">
        <TweakSection label="Палитра">
          <TweakRadio
            label="Палитра"
            value={t.palette}
            options={[
              { value: 'cream',     label: 'Cream' },
              { value: 'midnight',  label: 'Midnight' },
              { value: 'editorial', label: 'Paper' },
            ]}
            onChange={v => setTweak('palette', v)}
          />
        </TweakSection>
        <TweakSection label="Голос">
          <TweakRadio
            label="Тон"
            value={t.voice}
            options={[
              { value: 'editorial', label: 'Editorial' },
              { value: 'tech',      label: 'Tech' },
              { value: 'quiet',     label: 'Quiet' },
            ]}
            onChange={v => setTweak('voice', v)}
          />
        </TweakSection>
        <TweakSection label="Энергия">
          <TweakRadio
            label="Движение"
            value={t.energy}
            options={[
              { value: 'calm',   label: 'Calm' },
              { value: 'lively', label: 'Lively' },
            ]}
            onChange={v => setTweak('energy', v)}
          />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

// ============================================
// Nav
// ============================================
function Nav({ onCta }) {
  return (
    <header className="nav">
      <a className="logo" href="#">
        <span className="logo-mark">C</span>
        <span className="logo-name">CURS</span>
      </a>
      <nav className="nav-links">
        <a href="#features">Возможности</a>
        <a href="#community">Сообщество</a>
        <a href="#planner">Планировщик</a>
        <a href="CURS Mobile.html">Мобильное</a>
      </nav>
      <div className="nav-actions">
        <a href="#" className="nav-link-sm">Войти</a>
        <button className="btn-primary" onClick={onCta}>Открыть приложение →</button>
      </div>
    </header>
  );
}

// ============================================
// Hero
// ============================================
function Hero() {
  return (
    <section className="hero">
      <div className="hero-grid">
        <div className="hero-text">
          <span className="hero-badge">
            <span className="dot"></span>
            v2.4 · теперь с планировщиком сделок
          </span>
          <h1 className="hero-title">
            Один трекер
            <br />
            для всего, что
            <br />
            у вас <em>есть</em>.
          </h1>
          <p className="hero-sub">
            Акции, облигации, крипта, валюта — в одном месте.
            Несколько портфелей, продуманная аналитика, расчёт сделок наперёд.
            Без лишнего.
          </p>
          <div className="hero-cta">
            <a className="btn-primary lg" href="CURS Portfolio Tracker.html">
              Попробовать бесплатно
              <span className="arrow">→</span>
            </a>
            <a className="btn-ghost lg" href="#features">Узнать больше</a>
          </div>
          <div className="hero-meta">
            <Stat n="12 400+" l="портфелей" />
            <Stat n="86" l="виджетов в галерее" />
            <Stat n="4,9" l="из 5 в App Store" />
          </div>
        </div>

        <HeroVisual />
      </div>
    </section>
  );
}

function Stat({ n, l }) {
  return (
    <div className="stat">
      <div className="stat-n">{n}</div>
      <div className="stat-l">{l}</div>
    </div>
  );
}

function HeroVisual() {
  return (
    <div className="hero-visual">
      {/* Big total card */}
      <div className="hv-main">
        <div className="hv-label">Все портфели</div>
        <div className="hv-num">2,84 <span className="hv-unit">млн ₽</span></div>
        <div className="hv-delta">
          <span className="delta up">▲ 14,2%</span>
          <span className="hv-period">· за год</span>
        </div>
        <svg className="hv-spark" viewBox="0 0 320 64" preserveAspectRatio="none">
          <defs>
            <linearGradient id="hvg" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(31, 138, 79, 0.30)" />
              <stop offset="100%" stopColor="rgba(31, 138, 79, 0)" />
            </linearGradient>
          </defs>
          <path d="M0,42 C30,38 60,46 90,38 C120,28 150,32 180,22 C210,14 240,18 270,12 C290,8 310,4 320,2 L320,64 L0,64 Z" fill="url(#hvg)" />
          <path d="M0,42 C30,38 60,46 90,38 C120,28 150,32 180,22 C210,14 240,18 270,12 C290,8 310,4 320,2" fill="none" stroke="#1F8A4F" strokeWidth="1.8" />
        </svg>
      </div>

      {/* Floating cards */}
      <div className="hv-float hv-float-1">
        <div className="hv-row">
          <div className="hv-icn" style={{background: '#15140F', color: '#D7E041'}}>SBER</div>
          <div className="hv-meta">
            <div className="hv-meta-id">Сбербанк</div>
            <div className="hv-meta-sub">420 шт · ср. 245 ₽</div>
          </div>
          <div className="hv-pos">
            <div className="hv-pos-v">139 608 ₽</div>
            <div className="delta up sm">+35,7%</div>
          </div>
        </div>
        <div className="hv-row">
          <div className="hv-icn" style={{background: '#EE7544', color: '#fff'}}>BTC</div>
          <div className="hv-meta">
            <div className="hv-meta-id">Bitcoin</div>
            <div className="hv-meta-sub">0,42 · ср. 62 400 $</div>
          </div>
          <div className="hv-pos">
            <div className="hv-pos-v">3,77 млн ₽</div>
            <div className="delta up sm">+54,5%</div>
          </div>
        </div>
        <div className="hv-row">
          <div className="hv-icn" style={{background: '#1F8F6F', color: '#fff'}}>NVDA</div>
          <div className="hv-meta">
            <div className="hv-meta-id">NVIDIA</div>
            <div className="hv-meta-sub">95 шт · ср. 91 $</div>
          </div>
          <div className="hv-pos">
            <div className="hv-pos-v">1,49 млн ₽</div>
            <div className="delta up sm">+85,1%</div>
          </div>
        </div>
      </div>

      <div className="hv-float hv-float-2">
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom: 10}}>
          <div className="hv-icn" style={{background: 'rgba(47,125,67,.10)', color: '#1F8A4F', width: 36, height: 36, borderRadius: 10}}>↑</div>
          <div style={{flex:1}}>
            <div style={{fontWeight: 600, fontSize: 13}}>Купить 25 NVDA</div>
            <div style={{fontSize: 11, color: '#9CA3AF'}}>по 175 $ · 30 мая</div>
          </div>
        </div>
        <div className="hv-flow">
          <span style={{color:'#1F8A4F', fontWeight: 700, fontSize: 16}}>−4 375 $</span>
          <span style={{fontSize: 11, color: '#9CA3AF'}}>из USD</span>
        </div>
      </div>

      <div className="hv-float hv-float-3">
        <div style={{fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500, marginBottom: 6}}>По классам</div>
        <div style={{display: 'flex', gap: 4, height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 8}}>
          <div style={{flex: 62, background: '#15140F'}}></div>
          <div style={{flex: 28, background: '#EE7544'}}></div>
          <div style={{flex: 10, background: '#86B0A0'}}></div>
        </div>
        <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: 'JetBrains Mono', color: '#6B7280'}}>
          <span>Финансы 62%</span>
          <span>Крипта 28%</span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Marquee — trusted by
// ============================================
function Marquee() {
  const items = ['MOEX ISS', 'CoinGecko', 'ЦБ РФ', 'Bloomberg compat.', 'OFZ Live', 'Tinkoff API'];
  return (
    <div className="marquee">
      <span className="marquee-label">Данные из:</span>
      <div className="marquee-track">
        {[...items, ...items].map((it, i) => <span key={i} className="marquee-item">{it}</span>)}
      </div>
    </div>
  );
}

// ============================================
// Features
// ============================================
function Features() {
  return (
    <section id="features" className="features">
      <SectionHead eyebrow="что внутри" title={<>Простое снаружи —<br /><em>мощное</em> внутри.</>} />
      <div className="features-grid">
        <FeatCard
          eyebrow="01"
          title="3 класса активов"
          desc="Трад. финансы, крипта, валюты. Дивиденды учитываются на обе категории. Никаких сущностей сверх необходимого."
          accent="#15140F"
          art={<ClassesArt />}
        />
        <FeatCard
          eyebrow="02"
          title="Несколько портфелей"
          desc="Основной, долгосрочный, спекулятивный, под ребёнка — сколько нужно. Каждому — своя стратегия и аналитика."
          accent="#EE7544"
          art={<PortfoliosArt />}
        />
        <FeatCard
          eyebrow="03"
          title="6 типов сделок"
          desc="Покупка, продажа, транзакция, пополнение, вывод и дивиденд. Транзакция — это просто обмен одного актива на другой."
          accent="#1F8A4F"
          art={<TxTypesArt />}
        />
        <FeatCard
          eyebrow="04"
          title="Кастомная аналитика"
          desc="Один общий дашборд: добавляйте, удаляйте, переставляйте виджеты. CAGR, Sharpe, Эфф. граница, Monte Carlo — то что нужно вам."
          accent="#4F6BED"
          art={<AnalyticsArt />}
        />
      </div>
    </section>
  );
}

function FeatCard({ eyebrow, title, desc, accent, art }) {
  return (
    <div className="feat-card">
      <div className="feat-art" style={{background: accent}}>{art}</div>
      <div className="feat-body">
        <span className="feat-eyebrow">{eyebrow}</span>
        <h3 className="feat-title">{title}</h3>
        <p className="feat-desc">{desc}</p>
      </div>
    </div>
  );
}

// ---- Feature art (inline SVG/HTML) ----
function ClassesArt() {
  return (
    <div className="art-classes">
      {[
        { lb: 'Финансы', c: '#15140F', d: ['SBER', 'YNDX', 'AAPL', 'NVDA'] },
        { lb: 'Крипта',  c: '#EE7544', d: ['BTC', 'ETH', 'SOL'] },
        { lb: 'Валюты',  c: '#86B0A0', d: ['RUB', 'USD', 'EUR'] },
      ].map((g, i) => (
        <div key={i} className="art-class-col" style={{animationDelay: i * 0.1 + 's'}}>
          <div style={{fontSize: 10, color: 'rgba(255,255,255,0.65)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em'}}>{g.lb}</div>
          {g.d.map((id, j) => (
            <div key={j} className="art-token" style={{background: g.c, color: '#fff', fontWeight: 600, opacity: 1 - j*0.15}}>{id}</div>
          ))}
        </div>
      ))}
    </div>
  );
}

function PortfoliosArt() {
  return (
    <div className="art-pfs">
      {[
        { n: 'Основной', c: '#15140F', v: '1,8 млн', p: '+12,4%' },
        { n: 'Долгосроч.', c: '#2F4858', v: '720к', p: '+7,1%' },
        { n: 'Крипта',   c: '#EE7544', v: '320к', p: '+38%' },
      ].map((pf, i) => (
        <div key={i} className="art-pf-card" style={{animationDelay: i * 0.15 + 's'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6}}>
            <span style={{width: 8, height: 8, borderRadius: 2, background: pf.c}}></span>
            <span style={{fontSize: 11, fontWeight: 600}}>{pf.n}</span>
          </div>
          <div style={{fontSize: 16, fontWeight: 700, fontFamily: 'JetBrains Mono', letterSpacing: '-0.02em'}}>{pf.v} <span style={{fontSize:10, color:'#9CA3AF'}}>₽</span></div>
          <div style={{fontSize: 11, color: '#1F8A4F', fontWeight: 600, fontFamily: 'JetBrains Mono', marginTop: 2}}>{pf.p}</div>
        </div>
      ))}
    </div>
  );
}

function TxTypesArt() {
  const types = [
    { gl: '↑', lb: 'Покупка',    c: '#1F8A4F' },
    { gl: '↓', lb: 'Продажа',    c: '#C0392B' },
    { gl: '⇄', lb: 'Транзакция', c: '#15140F' },
    { gl: '＋', lb: 'Ввод',       c: '#1F8A4F' },
    { gl: '−', lb: 'Вывод',      c: '#C0392B' },
    { gl: '◆', lb: 'Дивиденд',   c: '#B58300' },
  ];
  return (
    <div className="art-tx">
      {types.map((t, i) => (
        <div key={i} className="art-tx-pill" style={{animationDelay: i * 0.06 + 's'}}>
          <span className="art-tx-gl" style={{color: t.c}}>{t.gl}</span>
          {t.lb}
        </div>
      ))}
    </div>
  );
}

function AnalyticsArt() {
  return (
    <div className="art-analytics">
      <div className="art-an-kpi">
        <div className="art-an-kpi-l">CAGR</div>
        <div className="art-an-kpi-v">+24,1%</div>
      </div>
      <div className="art-an-kpi">
        <div className="art-an-kpi-l">Sharpe</div>
        <div className="art-an-kpi-v">1,82</div>
      </div>
      <svg className="art-an-chart" viewBox="0 0 200 80" preserveAspectRatio="none">
        <defs>
          <linearGradient id="ag" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.45)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
        <path d="M0,60 C20,55 40,62 60,50 C80,42 100,46 120,32 C140,22 160,28 180,14 L200,8 L200,80 L0,80 Z" fill="url(#ag)" />
        <path d="M0,60 C20,55 40,62 60,50 C80,42 100,46 120,32 C140,22 160,28 180,14 L200,8" fill="none" stroke="#fff" strokeWidth="1.6" />
      </svg>
    </div>
  );
}

// ============================================
// Product showcase
// ============================================
function ProductShowcase() {
  return (
    <section className="showcase">
      <div className="showcase-text">
        <SectionHead eyebrow="дашборд" title={<>Аналитика —<br /><em>как вам</em> удобно.</>} compact />
        <p className="lead">
          Один настраиваемый дашборд вместо десяти вложенных табов.
          Добавляйте виджеты из официальной библиотеки или от сообщества — и собирайте свой идеальный экран.
        </p>
        <ul className="check-list">
          <li><Check /> 24 виджета в каталоге</li>
          <li><Check /> Перетаскивание, удаление, ресайз</li>
          <li><Check /> Свои виджеты на JSX</li>
          <li><Check /> Расчёт на исторических данных</li>
        </ul>
      </div>
      <div className="showcase-visual">
        <DashboardMock />
      </div>
    </section>
  );
}

function DashboardMock() {
  return (
    <div className="dash-mock">
      <div className="dash-bar">
        <div style={{display: 'flex', gap: 5}}>
          <span style={{width: 11, height: 11, borderRadius: '50%', background: '#FF5F57'}}></span>
          <span style={{width: 11, height: 11, borderRadius: '50%', background: '#FEBC2E'}}></span>
          <span style={{width: 11, height: 11, borderRadius: '50%', background: '#28C840'}}></span>
        </div>
        <div className="dash-url">curs.app · Аналитика</div>
      </div>
      <div className="dash-body">
        <div className="dash-kpi">
          <div className="kpi-lb">Стоимость</div>
          <div className="kpi-v">2,84 млн</div>
          <div className="delta up sm">+14,2%</div>
        </div>
        <div className="dash-kpi">
          <div className="kpi-lb">P&L</div>
          <div className="kpi-v up">+486к</div>
          <div className="delta up sm">+20,7%</div>
        </div>
        <div className="dash-kpi">
          <div className="kpi-lb">Sharpe</div>
          <div className="kpi-v">1,82</div>
          <div className="kpi-sub">(R−7%)/σ</div>
        </div>
        <div className="dash-kpi">
          <div className="kpi-lb">Max DD</div>
          <div className="kpi-v down">−8,4%</div>
          <div className="kpi-sub">за год</div>
        </div>
        <div className="dash-chart">
          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 12}}>
            <div>
              <div className="kpi-lb">Стоимость портфеля</div>
              <div style={{fontSize: 22, fontWeight: 600, fontFamily: 'JetBrains Mono', letterSpacing:'-0.02em', marginTop: 4}}>2,84 млн ₽</div>
            </div>
            <div style={{display: 'flex', gap: 4}}>
              {['1М','3М','1Г','Всё'].map((r, i) => (
                <span key={r} className={'dash-pill ' + (i === 2 ? 'active' : '')}>{r}</span>
              ))}
            </div>
          </div>
          <svg viewBox="0 0 600 130" preserveAspectRatio="none" style={{width: '100%', height: 130}}>
            <defs>
              <linearGradient id="dmg" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(21,20,15,0.18)" />
                <stop offset="100%" stopColor="rgba(21,20,15,0)" />
              </linearGradient>
            </defs>
            <path d="M0,90 C30,86 60,92 90,82 C120,74 150,78 180,68 C210,58 240,64 270,48 C300,38 330,42 360,28 C390,18 420,22 450,16 C480,10 510,12 540,8 L600,4 L600,130 L0,130 Z" fill="url(#dmg)" />
            <path d="M0,90 C30,86 60,92 90,82 C120,74 150,78 180,68 C210,58 240,64 270,48 C300,38 330,42 360,28 C390,18 420,22 450,16 C480,10 510,12 540,8 L600,4" fill="none" stroke="#15140F" strokeWidth="1.6" />
          </svg>
        </div>
        <div className="dash-tm">
          <div className="kpi-lb" style={{marginBottom: 10}}>Структура</div>
          <div className="tm-grid">
            <div className="tm-cell" style={{gridArea: 'a', background: '#15140F', color: '#fff'}}>SBER<small>17%</small></div>
            <div className="tm-cell" style={{gridArea: 'b', background: '#2F4858', color: '#fff'}}>BTC<small>14%</small></div>
            <div className="tm-cell" style={{gridArea: 'c', background: '#86B0A0', color: '#15140F'}}>NVDA<small>12%</small></div>
            <div className="tm-cell" style={{gridArea: 'd', background: '#D7E041', color: '#15140F'}}>LKOH<small>9%</small></div>
            <div className="tm-cell" style={{gridArea: 'e', background: '#EE7544', color: '#fff'}}>AAPL<small>8%</small></div>
            <div className="tm-cell" style={{gridArea: 'f', background: '#4F6BED', color: '#fff'}}>YNDX<small>7%</small></div>
            <div className="tm-cell" style={{gridArea: 'g', background: '#B58300', color: '#fff'}}>ETH<small>6%</small></div>
            <div className="tm-cell" style={{gridArea: 'h', background: '#1F8F6F', color: '#fff'}}>+4<small>27%</small></div>
          </div>
        </div>
        <div className="dash-classes">
          <div className="kpi-lb" style={{marginBottom: 10}}>По классам</div>
          <div className="dc-donut">
            <svg viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="32" fill="none" stroke="#F0EEE6" strokeWidth="13" />
              <circle cx="40" cy="40" r="32" fill="none" stroke="#15140F" strokeWidth="13" strokeDasharray="125 200" strokeDashoffset="0" transform="rotate(-90 40 40)" />
              <circle cx="40" cy="40" r="32" fill="none" stroke="#EE7544" strokeWidth="13" strokeDasharray="56 200" strokeDashoffset="-125" transform="rotate(-90 40 40)" />
              <circle cx="40" cy="40" r="32" fill="none" stroke="#86B0A0" strokeWidth="13" strokeDasharray="20 200" strokeDashoffset="-181" transform="rotate(-90 40 40)" />
            </svg>
            <div className="dc-legend">
              <LegendRow c="#15140F" l="Финансы" v="62%" />
              <LegendRow c="#EE7544" l="Крипта"  v="28%" />
              <LegendRow c="#86B0A0" l="Валюты"  v="10%" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LegendRow({ c, l, v }) {
  return (
    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11}}>
      <span style={{display: 'flex', alignItems: 'center', gap: 6}}>
        <span style={{width: 8, height: 8, background: c, borderRadius: 2}}></span>
        <span style={{fontWeight: 500}}>{l}</span>
      </span>
      <span style={{fontFamily: 'JetBrains Mono', fontWeight: 600}}>{v}</span>
    </div>
  );
}

// ============================================
// Planner section
// ============================================
function PlannerSection() {
  return (
    <section id="planner" className="planner-sec">
      <div className="planner-grid">
        <div className="planner-visual">
          <div className="pv-hero">
            <div className="hv-label">Чистый кэш-флоу</div>
            <div className="pv-num up">+1,24 <span className="hv-unit">млн ₽</span></div>
            <div style={{marginTop: 12, display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden'}}>
              <div style={{flex: 60, background: '#1F8A4F'}}></div>
              <div style={{flex: 40, background: '#C0392B'}}></div>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, fontFamily: 'JetBrains Mono', fontWeight: 600}}>
              <span style={{color: '#1F8A4F'}}>+2,1 млн</span>
              <span style={{color: '#C0392B'}}>−860к</span>
            </div>
          </div>
          {[
            { gl: '↑', lb: 'Купить 25 NVDA', sub: 'по 175 $ · 30 мая', amt: '−4 375 $', tone: 'down' },
            { gl: '↓', lb: 'Продать 8 YNDX', sub: 'по 5 200 ₽ · 15 июня', amt: '+41 600 ₽', tone: 'up' },
            { gl: '＋', lb: 'Пополнение', sub: '100 000 ₽ · 1 июня', amt: '+100к ₽', tone: 'up' },
          ].map((p, i) => (
            <div key={i} className="pv-card" style={{animationDelay: i * 0.1 + 's'}}>
              <div className={'pv-gl ' + p.tone}>{p.gl}</div>
              <div style={{flex: 1, minWidth: 0}}>
                <div style={{fontSize: 13, fontWeight: 600}}>{p.lb}</div>
                <div style={{fontSize: 11, color: '#9CA3AF', marginTop: 2}}>{p.sub}</div>
              </div>
              <div className={'pv-amt ' + p.tone}>{p.amt}</div>
            </div>
          ))}
        </div>
        <div className="planner-text">
          <SectionHead eyebrow="планировщик" title={<>Сначала планируйте.<br /><em>Потом</em> делайте.</>} compact />
          <p className="lead">
            Опишите сделки наперёд — система покажет чистый кэш-флоу, заработок и эффект на ваш портфель.
            Когда сделка состоится — одной кнопкой превратите её в реальную запись в журнале.
          </p>
          <ul className="check-list">
            <li><Check /> Покупки, продажи, обмены, дивиденды</li>
            <li><Check /> Расчёт P&L с учётом средневзвешенной</li>
            <li><Check /> Превратить план → в реальную сделку</li>
            <li><Check /> Список планов синхронизируется между устройствами</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

// ============================================
// Community section
// ============================================
function CommunitySection({ onSubmit }) {
  const [cat, setCat] = lUseState('Все');
  const filtered = COMMUNITY_WIDGETS.filter(w => cat === 'Все' || w.cat === cat);

  return (
    <section id="community" className="community">
      <div className="community-head">
        <SectionHead eyebrow="сообщество" title={<>Виджеты от<br />тех, кто <em>тоже</em> считает.</>} compact />
        <p className="lead" style={{maxWidth: 540}}>
          Не нашли нужный виджет? Кто-то уже сделал. <br />
          Готовые блоки для аналитики, налогов, целей, ребалансировки — публикуют люди, которым важна та же задача.
        </p>
      </div>

      <div className="community-controls">
        <div className="cat-list">
          {CATS.map(c => (
            <button key={c} className={'cat-btn ' + (cat === c ? 'active' : '')} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
        <button className="btn-primary" onClick={onSubmit}>
          + Опубликовать свой
        </button>
      </div>

      <div className="widgets-grid">
        {filtered.map(w => <WidgetCard key={w.id} w={w} />)}
        <button className="widget-card add" onClick={onSubmit}>
          <div className="widget-add-mark">＋</div>
          <div style={{textAlign: 'center'}}>
            <div style={{fontWeight: 600, marginBottom: 4}}>Ваш виджет здесь</div>
            <div style={{fontSize: 12, color: '#6B7280', lineHeight: 1.5, maxWidth: 220}}>
              Опубликуйте свою аналитику — увидят 12 400+ инвесторов.
            </div>
          </div>
        </button>
      </div>
    </section>
  );
}

function WidgetCard({ w }) {
  return (
    <div className="widget-card">
      <div className="widget-mark" style={{background: w.color}}>{w.glyph}</div>
      <div className="widget-meta">
        <span className="widget-cat">{w.cat}</span>
        <h4 className="widget-title">{w.title}</h4>
        <p className="widget-desc">{w.desc}</p>
      </div>
      <div className="widget-foot">
        <span className="widget-author">{w.author}</span>
        <span className="widget-installs">{w.installs.toLocaleString('ru-RU')} установок</span>
      </div>
    </div>
  );
}

// ============================================
// CTA
// ============================================
function Cta({ onCta }) {
  return (
    <section className="cta">
      <div className="cta-inner">
        <h2 className="cta-title">
          Начните вести портфели
          <br />
          <em>сегодня</em>.
        </h2>
        <p className="cta-sub">Бесплатно навсегда. Без рекламы. Ваши данные — только ваши.</p>
        <div className="hero-cta" style={{justifyContent: 'center'}}>
          <button className="btn-primary lg" onClick={onCta}>
            Открыть приложение <span className="arrow">→</span>
          </button>
          <a className="btn-ghost lg" href="CURS Mobile.html">
            Скачать на iPhone
          </a>
        </div>
      </div>
    </section>
  );
}

// ============================================
// Footer
// ============================================
function Footer() {
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div>
          <div className="logo" style={{marginBottom: 12}}>
            <span className="logo-mark">C</span>
            <span className="logo-name">CURS</span>
          </div>
          <div style={{fontSize: 13, color: '#6B7280', lineHeight: 1.6, maxWidth: 280}}>
            Трекер портфелей для всего, что у вас есть.
          </div>
        </div>
        <FootCol title="Продукт" links={['Возможности', 'Аналитика', 'Планировщик', 'Мобильное приложение']} />
        <FootCol title="Сообщество" links={['Каталог виджетов', 'Опубликовать свой', 'Discord', 'GitHub']} />
        <FootCol title="Компания" links={['О нас', 'Цены', 'Контакты', 'Юридическое']} />
      </div>
      <div className="footer-bot">
        <span>© 2026 CURS</span>
        <span>Сделано в Москве</span>
      </div>
    </footer>
  );
}

function FootCol({ title, links }) {
  return (
    <div>
      <div className="footer-title">{title}</div>
      <ul className="footer-links">
        {links.map(l => <li key={l}><a href="#">{l}</a></li>)}
      </ul>
    </div>
  );
}

// ============================================
// Submit modal
// ============================================
function SubmitModal({ onClose }) {
  const [step, setStep] = lUseState(1);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div style={{fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500, marginBottom: 4}}>шаг {step} из 3</div>
            <div style={{fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em'}}>Опубликовать виджет</div>
          </div>
          <button className="modal-x" onClick={onClose}>✕</button>
        </div>

        <div className="modal-steps">
          <div className={'step ' + (step >= 1 ? 'active' : '')}></div>
          <div className={'step ' + (step >= 2 ? 'active' : '')}></div>
          <div className={'step ' + (step >= 3 ? 'active' : '')}></div>
        </div>

        <div className="modal-body">
          {step === 1 && <>
            <SubField label="Название виджета">
              <input className="m-inp" placeholder="Например: Налоги РФ" />
            </SubField>
            <SubField label="Категория">
              <select className="m-inp">
                {CATS.filter(c => c !== 'Все').map(c => <option key={c}>{c}</option>)}
              </select>
            </SubField>
            <SubField label="Описание (1-2 предложения)">
              <textarea className="m-inp" rows="3" placeholder="Что виджет считает и зачем"></textarea>
            </SubField>
          </>}
          {step === 2 && <>
            <SubField label="Код виджета (JSX)">
              <textarea className="m-inp code" rows="9" defaultValue={`function MyWidget({ portfolio }) {
  return (
    <Card title="Мой виджет">
      {/* ... */}
    </Card>
  );
}`}></textarea>
            </SubField>
            <div style={{fontSize: 12, color: '#6B7280', padding: 12, background: '#F0EEE6', borderRadius: 8}}>
              Виджет получает <code>portfolio</code> и <code>range</code>. Доступны компоненты <code>Card</code>, <code>Sparkline</code>, <code>Donut</code>, <code>Heatmap</code>.
            </div>
          </>}
          {step === 3 && <>
            <SubField label="Ваш ник (с @)">
              <input className="m-inp" placeholder="@username" />
            </SubField>
            <SubField label="Способ связи (email или telegram)">
              <input className="m-inp" placeholder="hello@example.com" />
            </SubField>
            <div style={{fontSize: 12, color: '#6B7280', padding: 12, background: '#F0EEE6', borderRadius: 8, lineHeight: 1.5}}>
              ✓ Виджеты модерируются вручную (1–3 дня)<br />
              ✓ Авторы с 1000+ установок попадают в реестр верифицированных
            </div>
          </>}
        </div>

        <div className="modal-foot">
          {step > 1 && <button className="btn-ghost" onClick={() => setStep(step - 1)}>Назад</button>}
          <div style={{flex: 1}}></div>
          {step < 3
            ? <button className="btn-primary" onClick={() => setStep(step + 1)}>Дальше →</button>
            : <button className="btn-primary" onClick={onClose}>Отправить на модерацию</button>}
        </div>
      </div>
    </div>
  );
}

function SubField({ label, children }) {
  return (
    <div style={{marginBottom: 14}}>
      <div style={{fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500, marginBottom: 6}}>{label}</div>
      {children}
    </div>
  );
}

// ============================================
// Shared
// ============================================
function SectionHead({ eyebrow, title, compact }) {
  return (
    <div className={'section-head ' + (compact ? 'compact' : '')}>
      <span className="section-eyebrow">{eyebrow}</span>
      <h2 className="section-title">{title}</h2>
    </div>
  );
}

function Check() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink: 0}}>
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<LandingApp />);
