import { useEffect, useRef } from "react";

import { WS_BASE_URL } from "@/shared/config/env";
import type { QuoteMessage } from "@/shared/api/types";
import { authGetters } from "@/shared/store/auth";

/**
 * Подписка на live-котировки через `/ws/quotes`.
 * Авто-reconnect с экспоненциальным backoff. onQuote вызывается на каждое сообщение.
 */
export function useQuotesSocket(onQuote: (msg: QuoteMessage) => void, enabled: boolean) {
  const cbRef = useRef(onQuote);
  cbRef.current = onQuote;

  useEffect(() => {
    if (!enabled) return;
    let ws: WebSocket | null = null;
    let closed = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      const token = authGetters.access();
      if (!token) return;
      ws = new WebSocket(`${WS_BASE_URL}/ws/quotes?token=${encodeURIComponent(token)}`);

      ws.onmessage = (e) => {
        try {
          cbRef.current(JSON.parse(e.data as string) as QuoteMessage);
        } catch {
          /* ignore malformed */
        }
      };
      ws.onopen = () => {
        attempt = 0;
      };
      ws.onclose = () => {
        if (closed) return;
        const delay = Math.min(1000 * 2 ** attempt, 30000);
        attempt += 1;
        timer = setTimeout(connect, delay);
      };
      ws.onerror = () => ws?.close();
    };

    connect();
    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      ws?.close();
    };
  }, [enabled]);
}
