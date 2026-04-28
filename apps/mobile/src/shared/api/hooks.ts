import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { getBaseCurrency } from "@/shared/lib/format";

import { apiFetch } from "./client";
import type {
  AnalyticsLayout,
  AnalyticsMetricsResponse,
  Asset,
  AssetSearchItem,
  ByClassItem,
  DashboardOverview,
  LoginResponse,
  Metrics,
  Plan,
  PortfolioDetail,
  PortfolioSummary,
  Provider,
  ProviderTestResult,
  Range,
  RecalcJob,
  RecalcRequestBody,
  StructureItem,
  Transaction,
  User,
} from "./types";

export const qk = {
  me: ["me"] as const,
  overview: ["dashboard", "overview"] as const,
  portfolios: ["portfolios"] as const,
  portfolio: (id: string) => ["portfolios", id] as const,
  assets: ["assets"] as const,
  txs: (portfolio?: string) => ["transactions", portfolio ?? "all"] as const,
  metrics: (id: string, range: Range) => ["metrics", id, range] as const,
  series: (id: string, range: Range) => ["series", id, range] as const,
  structure: (id: string) => ["structure", id] as const,
  byClass: (id: string) => ["byClass", id] as const,
  plans: ["plans"] as const,
  providers: ["providers"] as const,
  layout: ["layout"] as const,
  analyticsMetrics: (id: string) => ["analyticsMetrics", id] as const,
  recalcJob: (jobId: string) => ["recalcJob", jobId] as const,
};

// ---------- Auth ----------
export function useLogin() {
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      apiFetch<LoginResponse>("/auth/login", { method: "POST", body, auth: false }),
  });
}

export function useMe(enabled: boolean) {
  return useQuery({
    queryKey: qk.me,
    queryFn: () => apiFetch<User>("/auth/me"),
    enabled,
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { current: string; new: string }) =>
      apiFetch<{ ok: boolean }>("/auth/password", { method: "POST", body }),
  });
}

// ---------- Dashboard ----------
export function useOverview() {
  const ccy = getBaseCurrency();
  return useQuery({
    queryKey: [...qk.overview, ccy],
    queryFn: () => apiFetch<DashboardOverview>("/dashboard/overview", { query: { ccy } }),
  });
}

// ---------- Portfolios ----------
export function usePortfolios() {
  const ccy = getBaseCurrency();
  return useQuery({
    queryKey: [...qk.portfolios, ccy],
    queryFn: () => apiFetch<PortfolioSummary[]>("/portfolios", { query: { ccy } }),
  });
}

export function useCreatePortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; color: string }) =>
      apiFetch<PortfolioSummary>("/portfolios", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.portfolios });
      qc.invalidateQueries({ queryKey: qk.overview });
    },
  });
}

export function useUpdatePortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { name?: string; color?: string } }) =>
      apiFetch<PortfolioSummary>(`/portfolios/${id}`, { method: "PUT", body }),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: qk.portfolios });
      qc.invalidateQueries({ queryKey: qk.portfolio(id) });
      qc.invalidateQueries({ queryKey: qk.overview });
    },
  });
}

export function useDeletePortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/portfolios/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.portfolios });
      qc.invalidateQueries({ queryKey: qk.overview });
    },
  });
}

export function usePortfolio(id: string | null) {
  const ccy = getBaseCurrency();
  return useQuery({
    queryKey: [...qk.portfolio(id ?? ""), ccy],
    queryFn: () => apiFetch<PortfolioDetail>(`/portfolios/${id}`, { query: { ccy } }),
    enabled: !!id,
  });
}

export function usePortfolioTransactions(id: string | null, limit = 14) {
  return useQuery({
    queryKey: [...qk.txs(id ?? "all"), limit],
    queryFn: () => apiFetch<Transaction[]>("/transactions", { query: { portfolio: id ?? undefined, limit } }),
    enabled: !!id,
  });
}

// ---------- Assets ----------
export function useAssets() {
  return useQuery({ queryKey: qk.assets, queryFn: () => apiFetch<Asset[]>("/assets") });
}

/** Поиск активов: локальный каталог (недавние первыми) + внешние кандидаты из API. */
export function useAssetSearch(q: string) {
  return useQuery({
    queryKey: ["assetSearch", q],
    queryFn: () => apiFetch<AssetSearchItem[]>("/assets/search", { query: { q, limit: 20 } }),
    placeholderData: (prev) => prev, // не мигаем пустотой между запросами
    staleTime: 30_000,
  });
}

/** Конвертация по курсу на дату: сколько `to` за `qty` единиц `from`. */
export function useConvert() {
  return useMutation({
    mutationFn: (p: { from: string; to: string; qty: number; at: string }) =>
      apiFetch<{ toQty: number; fromValueRub: number; rubFrom: number; rubTo: number; at: string }>(
        "/assets/convert",
        { query: p },
      ),
  });
}

/** Материализует выбранный внешний инструмент в каталог. */
export function useImportAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      id: string;
      name: string;
      class: "tradfi" | "crypto" | "fiat";
      subclass?: string | null;
      ccy: string;
      source?: string | null;
      figi?: string | null;
      coingeckoId?: string | null;
    }) => apiFetch<Asset>("/assets/import", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.assets }),
  });
}

// ---------- Transactions ----------
export function useRecentTransactions(limit = 6) {
  return useQuery({
    queryKey: [...qk.txs(), "recent", limit],
    queryFn: () => apiFetch<Transaction[]>("/transactions", { query: { limit } }),
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch<Transaction>("/transactions", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: qk.portfolios });
      qc.invalidateQueries({ queryKey: qk.overview });
    },
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiFetch<Transaction>(`/transactions/${id}`, { method: "PUT", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: qk.portfolios });
      qc.invalidateQueries({ queryKey: qk.overview });
    },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/transactions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: qk.portfolios });
      qc.invalidateQueries({ queryKey: qk.overview });
    },
  });
}

// ---------- Analytics ----------
export function useMetrics(id: string, range: Range) {
  return useQuery({
    queryKey: qk.metrics(id, range),
    queryFn: () => apiFetch<Metrics>(`/portfolios/${id}/metrics`, { query: { range } }),
    enabled: !!id,
  });
}

export function useSeries(id: string, range: Range) {
  const ccy = getBaseCurrency();
  return useQuery({
    queryKey: [...qk.series(id, range), ccy],
    queryFn: () => apiFetch<{ d: string; v: number }[]>(`/portfolios/${id}/series`, { query: { range, ccy } }),
    enabled: !!id,
  });
}

export function useStructure(id: string) {
  const ccy = getBaseCurrency();
  return useQuery({
    queryKey: [...qk.structure(id), ccy],
    queryFn: () => apiFetch<StructureItem[]>(`/portfolios/${id}/structure`, { query: { ccy } }),
    enabled: !!id,
  });
}

export function useByClass(id: string) {
  const ccy = getBaseCurrency();
  return useQuery({
    queryKey: [...qk.byClass(id), ccy],
    queryFn: () => apiFetch<ByClassItem[]>(`/portfolios/${id}/by-class`, { query: { ccy } }),
    enabled: !!id,
  });
}

export function useLayout() {
  return useQuery({ queryKey: qk.layout, queryFn: () => apiFetch<AnalyticsLayout>("/users/me/analytics-layout") });
}

export function useSaveLayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (widgetIds: string[]) =>
      apiFetch<AnalyticsLayout>("/users/me/analytics-layout", { method: "PUT", body: { widgetIds } }),
    onSuccess: (data) => qc.setQueryData(qk.layout, data),
  });
}

// ---------- Risk analytics (Stage 5) ----------
/** Последние сохранённые секции аналитики портфеля (все секции одним запросом). */
export function useAnalyticsMetrics(id: string | null) {
  return useQuery({
    queryKey: qk.analyticsMetrics(id ?? ""),
    queryFn: () => apiFetch<AnalyticsMetricsResponse>(`/portfolios/${id}/analytics/metrics`),
    enabled: !!id,
  });
}

/** Поставить пересчёт аналитики в очередь. Возвращает задачу (jobId + статус). */
export function useStartRecalc() {
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: RecalcRequestBody }) =>
      apiFetch<RecalcJob>(`/portfolios/${id}/analytics/recalc`, { method: "POST", body: body ?? {} }),
  });
}

/** Опрос статуса задачи пересчёта; останавливается на done/failed. */
export function useRecalcJob(jobId: string | null) {
  return useQuery({
    queryKey: qk.recalcJob(jobId ?? ""),
    queryFn: () => apiFetch<RecalcJob>(`/analytics/jobs/${jobId}`),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "done" || status === "failed" ? false : 1000;
    },
  });
}

// ---------- Plans ----------
export function usePlans() {
  return useQuery({ queryKey: qk.plans, queryFn: () => apiFetch<Plan[]>("/users/me/plans") });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch<Plan>("/users/me/plans", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.plans }),
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiFetch<Plan>(`/users/me/plans/${id}`, { method: "PUT", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.plans }),
  });
}

export function useExecuteAllPlans() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<Transaction[]>("/users/me/plans/execute-all", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.plans });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: qk.portfolios });
      qc.invalidateQueries({ queryKey: qk.overview });
    },
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/users/me/plans/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.plans }),
  });
}

export function useExecutePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<Transaction>(`/users/me/plans/${id}/execute`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.plans });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: qk.portfolios });
      qc.invalidateQueries({ queryKey: qk.overview });
    },
  });
}

// ---------- Providers ----------
export function useProviders() {
  return useQuery({ queryKey: qk.providers, queryFn: () => apiFetch<Provider[]>("/users/me/providers") });
}

export function useSaveProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, connected, fields }: { id: string; connected: boolean; fields: Record<string, string> }) =>
      apiFetch<Provider>(`/users/me/providers/${id}`, { method: "PUT", body: { connected, fields } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.providers }),
  });
}

export function useTestProvider() {
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<ProviderTestResult>(`/users/me/providers/${id}/test`, { method: "POST" }),
  });
}

export type { UseQueryOptions };
