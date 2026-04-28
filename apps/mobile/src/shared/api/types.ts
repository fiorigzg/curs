/**
 * TS-типы под DTO бэкенда (camelCase-алиасы из CamelModel).
 * Дублируют контракт `apps/api/src/curs_api/schemas/*`.
 */

export type AssetClass = "tradfi" | "crypto" | "fiat";
export type TxType = "in" | "out" | "tx" | "div";
export type PlanType = "buy" | "sell" | "tx" | "in" | "out" | "div";

export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
}

export interface PointTV {
  d: string;
  v: number;
}

export interface TradeMarker {
  d: string; // дата сделки (YYYY-MM-DD)
  kind: "buy" | "sell";
  fromAsset: string;
  toAsset: string;
  fromQty: number;
  toQty: number;
}

export interface Asset {
  id: string;
  name: string;
  class: AssetClass;
  subclass?: string | null;
  sub?: string | null;
  ccy: string;
  icon: string;
  price?: number | null;
}

/** Элемент поиска активов: локальный актив или внешний кандидат на импорт. */
export interface AssetSearchItem extends Asset {
  importable: boolean;
  source?: string | null;
}

export interface ByClass {
  tradfi: number;
  crypto: number;
  fiat: number;
}

export interface DashboardOverview {
  total: number;
  totalCost: number;
  totalPl: number;
  totalPlPct: number;
  yearPct: number;
  series: PointTV[];
  firstTxDate?: string | null; // дата самой первой транзакции (YYYY-MM-DD)
  byClass: ByClass;
}

export interface PortfolioSummary {
  id: string;
  name: string;
  color: string;
  positionsCount: number;
  total: number;
  deltaPct90d: number;
  series90d: PointTV[];
}

export interface Position {
  /** Порядковый номер позиции внутри пары from→to (1-based). */
  seq: number;
  from: Asset;
  to: Asset;
  closed: boolean;
  redeployed: boolean; // закрыта перекладыванием в другой актив (не обратной продажей)
  qty: number; // остаток `to`
  avgPrice: number;
  avgClose: number; // средняя цена выхода (₽/ед.); 0 если продаж не было
  valBase: number;
  costBase: number; // суммарно вложено, ₽
  pl: number; // суммарный P&L (реализ. + нереализ.), ₽
  plannedPl: number; // P&L, если исполнить запланированные продажи, ₽
  assetPl: number; // P&L в валюте `from` пары (USDT/₽…)
  unrealizedPl: number;
  realizedPl: number;
  plPct: number;
  share: number;
}

export interface PortfolioDetail {
  id: string;
  name: string;
  color: string;
  total: number;
  totalCost: number;
  pl: number; // суммарный P&L (реализ. + нереализ.), ₽
  unrealizedPl: number;
  realizedPl: number;
  plPct: number;
  deltaPct3M: number;
  pnlSeries: PointTV[]; // P&L во времени от первой транзакции портфеля
  tradeMarkers: TradeMarker[]; // точки покупок/продаж на графике
  positions: Position[];
}

export interface Leg {
  asset: string;
  qty: number;
}

export interface Transaction {
  id: string;
  type: TxType;
  portfolio: string;
  d: string;
  asset?: string | null;
  qty?: number | null;
  from?: Leg | null;
  to?: Leg | null;
  source?: string | null;
  cashAsset?: string | null;
}

export interface Metrics {
  vol: number;
  sharpe: number;
  sortino: number;
  maxDd: number;
  annRet: number;
  cagr: number;
  calmar: number;
}

export interface StructureItem {
  label: string;
  value: number;
  share: number;
  color: string;
}

export interface ByClassItem {
  class: AssetClass;
  value: number;
  share: number;
}

export interface Plan {
  id: string;
  type: PlanType;
  portfolioId: string;
  d: string;
  assetId?: string | null;
  qty?: number | null;
  price?: number | null;
  cashAsset?: string | null;
  fromAsset?: string | null;
  fromQty?: number | null;
  toAsset?: string | null;
  toQty?: number | null;
  source?: string | null;
}

export interface Provider {
  id: "tinkoff" | "coingecko";
  connected: boolean;
  fields: Record<string, string>;
  lastTestOk?: boolean | null;
  lastTestLatencyMs?: number | null;
}

export interface ProviderTestResult {
  ok: boolean;
  latencyMs?: number | null;
  error?: string | null;
}

export interface AnalyticsLayout {
  widgetIds: string[];
}

export type Range = "1Н" | "1М" | "3М" | "1Г" | "Всё";

// ──────────────────────────── Риск-аналитика (Stage 5) ────────────────────────────
export type RecalcSection =
  | "per_asset"
  | "risk"
  | "capm"
  | "correlation"
  | "pairwise"
  | "optimization"
  | "monte_carlo";

export type JobStatus = "queued" | "running" | "done" | "failed";
/** Состояние кнопки «Пересчитать» (idle — клиентское до запуска). */
export type RecalcUiState = "idle" | JobStatus;

export interface RecalcJob {
  id: string;
  portfolioId: string;
  status: JobStatus;
  progress: number; // 0–100
  sections: RecalcSection[];
  doneSections: RecalcSection[];
  error?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface RecalcRequestBody {
  sections?: RecalcSection[];
  marketShock?: number;
  simulations?: number;
  horizon?: number;
}

export interface XYPoint {
  x: number;
  y: number;
  label?: string;
}

export interface PortfolioPerf {
  ret: number;
  risk: number;
  sharpe: number;
  weights: number[];
}

export interface LineParams {
  intercept: number;
  slope: number;
}

// per_asset
export interface PerAssetItem {
  id: string;
  name: string;
  class?: string | null;
  weight: number;
  meanDaily: number;
  annReturn: number;
  annVol: number;
  beta: number | null;
  alpha: number | null;
  r2: number | null;
  idioVol: number | null;
  insufficientData: boolean;
}
export interface PerAssetMetrics {
  insufficientData: boolean;
  note?: string;
  marketId?: string;
  market?: { annReturn: number | null; annVol: number | null };
  riskFreeAnnual?: number;
  assets?: PerAssetItem[];
}

// risk
export interface StressScenario {
  shock: number;
  model: number;
  empirical: number | null;
}
export interface RiskMetrics {
  insufficientData: boolean;
  note?: string;
  marketId?: string;
  betaP?: number;
  scenarios?: StressScenario[];
  conditionalWorst?: {
    portfolioMean: number | null;
    marketMean: number | null;
    nDays: number;
    insufficientData?: boolean;
  };
  worstPct?: number;
}

// capm
export interface CapmMetrics {
  insufficientData: boolean;
  note?: string;
  marketId?: string;
  riskFreeAnnual?: number;
  sml?: {
    points: XYPoint[];
    line: LineParams;
    market: { beta: number; annReturn: number };
  };
  cml?: { line: LineParams; tangency: PortfolioPerf; assets: XYPoint[] };
}

// correlation
export interface RollingPair {
  pair: string;
  a: string;
  b: string;
  dates: string[];
  values: number[];
}
export interface CorrelationMetrics {
  insufficientData: boolean;
  note?: string;
  labels?: string[];
  matrix?: number[][];
  rolling?: RollingPair[];
}

// pairwise
export interface PairwiseSummaryItem {
  assetA: string;
  assetB: string;
  r2: number;
  maxSharpe: number;
  hedgeReduction: number;
  rho: number;
}
export interface PairwiseMetrics {
  insufficientData: boolean;
  note?: string;
  pairs?: PairwiseSummaryItem[];
}

// optimization
export interface OptimizationMetrics {
  insufficientData: boolean;
  note?: string;
  frontier?: { risk: number; ret: number }[];
  minvar?: PortfolioPerf;
  tangency?: PortfolioPerf;
  current?: PortfolioPerf;
  assets?: (XYPoint & { weight: number })[];
  bestCombination?: Record<string, number>;
}

// monte_carlo
export interface McRun {
  method: string;
  startValue: number;
  horizon: number;
  nSimulations: number;
  terminalMean: number;
  terminalMedian: number;
  percentilesTerminal: Record<string, number>;
  var: { var95: number; var99: number; var95Value: number; var99Value: number };
  cvar: { cvar95: number; cvar99: number; cvar95Value: number; cvar99Value: number };
  probLoss: number;
  fan: Record<string, number[]>;
  samplePaths: number[][];
}
export interface MonteCarloMetrics {
  insufficientData: boolean;
  note?: string;
  parametric?: McRun;
  bootstrap?: McRun;
}

export interface SectionEnvelope<T> {
  payload: T;
  computedAt: string;
}
export interface AnalyticsMetricsResponse {
  portfolioId: string;
  sections: Partial<{
    per_asset: SectionEnvelope<PerAssetMetrics>;
    risk: SectionEnvelope<RiskMetrics>;
    capm: SectionEnvelope<CapmMetrics>;
    correlation: SectionEnvelope<CorrelationMetrics>;
    pairwise: SectionEnvelope<PairwiseMetrics>;
    optimization: SectionEnvelope<OptimizationMetrics>;
    monte_carlo: SectionEnvelope<MonteCarloMetrics>;
  }>;
}

// Live-сообщение WebSocket
export interface QuoteMessage {
  type: "quote" | "portfolio-tick";
  assetId?: string;
  price?: number;
  ts?: string;
  portfolioId?: string;
  total?: number;
}
