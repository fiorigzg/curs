// CURS — App shell
const { useState: appUseState, useEffect: appUseEffect, useMemo: appUseMemo } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "density": "cozy",
  "privacy": false,
  "accent": "#D7E041"
}/*EDITMODE-END*/;

function App() {
  const [route, setRoute] = appUseState('dashboard');
  const [activePortfolio, setActivePortfolio] = appUseState('main');
  const [dataVer, setDataVer] = appUseState(0);

  // Modals
  const [addTxOpen, setAddTxOpen] = appUseState(false);
  const [addAssetOpen, setAddAssetOpen] = appUseState(false);
  const [modalPortfolio, setModalPortfolio] = appUseState(null);

  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  appUseEffect(() => {
    document.documentElement.dataset.density = t.density;
    document.documentElement.dataset.privacy = t.privacy ? 'on' : 'off';
    document.documentElement.style.setProperty('--accent-2', t.accent);
  }, [t.density, t.privacy, t.accent]);

  const portfolios = CURS_DATA.PORTFOLIOS;
  const portfolio = portfolios.find(p => p.id === activePortfolio) || portfolios[0];

  const crumbs = appUseMemo(() => {
    if (route === 'dashboard') return ['CURS', 'Обзор'];
    if (route === 'portfolio') return ['CURS', 'Портфели', portfolio.name];
    if (route === 'analytics') return ['CURS', 'Аналитика', portfolio.name];
    if (route === 'calc')      return ['CURS', 'Планировщик'];
    if (route === 'settings')  return ['CURS', 'Настройки'];
    return ['CURS'];
  }, [route, portfolio]);

  function openAdd(kind, pf) {
    setModalPortfolio(pf || null);
    if (kind === 'tx')        setAddTxOpen(true);
    else if (kind === 'asset')setAddAssetOpen(true);
    else if (kind === 'portfolio') alert('Создание портфеля — в разработке');
  }

  function executeTransactions(txs) {
    // Prepend so newest appears first in lists
    [...txs].reverse().forEach(tx => CURS_DATA.TX.unshift(tx));
    setDataVer(v => v + 1);
  }

  return (
    <div className="app">
      <CURS_UI.Sidebar
        route={route}
        setRoute={setRoute}
        portfolios={portfolios}
        activePortfolio={activePortfolio}
        setActivePortfolio={setActivePortfolio}
        onAdd={openAdd}
      />
      <main className="main">
        <CURS_UI.TopBar
          crumbs={crumbs}
          privacy={t.privacy}
          setPrivacy={v => setTweak('privacy', v)}
          onAddTx={() => openAdd('tx', route === 'portfolio' ? portfolio : null)}
        />
        {route === 'dashboard' && (
          <CURS_DASHBOARD.Dashboard
            portfolios={portfolios}
            setRoute={setRoute}
            setActivePortfolio={setActivePortfolio}
            onOpenAddTx={() => openAdd('tx', null)}
          />
        )}
        {route === 'portfolio' && (
          <CURS_PORTFOLIO.PortfolioScreen
            portfolio={portfolio}
            onAddAsset={pf => openAdd('asset', pf)}
            onAddTx={pf => openAdd('tx', pf)}
          />
        )}
        {route === 'analytics' && (
          <CURS_ANALYTICS.AnalyticsScreen
            portfolio={portfolio}
            allPortfolios={portfolios}
            setActivePortfolio={setActivePortfolio}
          />
        )}
        {route === 'calc' && (
          <CURS_CALC.CalcScreen portfolios={portfolios} onExecute={executeTransactions} />
        )}
        {route === 'settings' && (
          <CURS_SETTINGS.SettingsScreen />
        )}
      </main>

      <CURS_MODALS.AddTxModal
        open={addTxOpen}
        portfolio={modalPortfolio}
        allPortfolios={portfolios}
        onClose={() => setAddTxOpen(false)}
      />
      <CURS_MODALS.AddAssetModal
        open={addAssetOpen}
        portfolio={modalPortfolio}
        onClose={() => setAddAssetOpen(false)}
      />

      <TweaksPanel title="Оформление">
        <TweakSection label="Интерфейс">
          <TweakRadio label="Плотность" value={t.density}
            options={[{ value: 'cozy', label: 'Уютно' }, { value: 'compact', label: 'Плотно' }]}
            onChange={v => setTweak('density', v)} />
          <TweakColor label="Акцент" value={t.accent}
            options={['#D7E041', '#EE7544', '#4F6BED', '#86B0A0']}
            onChange={v => setTweak('accent', v)} />
          <TweakToggle label="Privacy режим" value={t.privacy} onChange={v => setTweak('privacy', v)} />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
