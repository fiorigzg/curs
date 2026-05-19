/**
 * useRecalc — оркестратор пересчёта аналитики для кнопки «Пересчитать».
 *
 * Запускает задачу (POST recalc), опрашивает её статус (polling в useRecalcJob),
 * по завершении инвалидирует кэш метрик аналитики, чтобы графики перезапросили
 * свежие данные. Возвращает состояние для UI: idle/queued/running(%)/done/failed.
 */
import { useEffect, useRef, useState } from "react";

import { useQueryClient } from "@tanstack/react-query";

import { qk, useRecalcJob, useStartRecalc } from "@/shared/api/hooks";
import { ApiError } from "@/shared/api/client";
import type { RecalcSection, RecalcUiState } from "@/shared/api/types";

export interface RecalcController {
  uiState: RecalcUiState;
  progress: number;
  doneSections: RecalcSection[];
  error?: string | null;
  isBusy: boolean;
  run: () => void;
}

export function useRecalc(
  portfolioId: string | undefined,
  sections?: RecalcSection[],
): RecalcController {
  const qc = useQueryClient();
  const start = useStartRecalc();
  const [jobId, setJobId] = useState<string | null>(null);
  const job = useRecalcJob(jobId);
  const handledRef = useRef<string | null>(null);

  const status = job.data?.status;
  const uiState: RecalcUiState = start.isPending
    ? "queued"
    : (status ?? (start.isError ? "failed" : "idle"));
  const progress = job.data?.progress ?? 0;

  // По завершении задачи — инвалидируем метрики аналитики (один раз на задачу).
  useEffect(() => {
    if (!jobId || !status) return;
    if ((status === "done" || status === "failed") && handledRef.current !== jobId) {
      handledRef.current = jobId;
      if (status === "done" && portfolioId) {
        qc.invalidateQueries({ queryKey: qk.analyticsMetrics(portfolioId) });
      }
    }
  }, [status, jobId, portfolioId, qc]);

  function run() {
    if (!portfolioId || uiState === "queued" || uiState === "running") return;
    handledRef.current = null;
    start.mutate(
      { id: portfolioId, body: sections ? { sections } : undefined },
      { onSuccess: (j) => setJobId(j.id) },
    );
  }

  const startErr = start.error instanceof ApiError ? start.error.message : null;
  const isBusy = uiState === "queued" || uiState === "running";
  return {
    uiState,
    progress,
    doneSections: job.data?.doneSections ?? [],
    error: job.data?.error ?? startErr,
    isBusy,
    run,
  };
}
