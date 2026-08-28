import { useEffect, useRef } from "react";

interface AutoRefreshOptions {
  enabled?: boolean;
  intervalMs?: number;
  refreshOnFocus?: boolean;
  scopeKey?: string;
}

type Refresh = () => Promise<unknown>;

export default function useAutoRefresh(
  refresh: Refresh,
  {
    enabled = true,
    intervalMs,
    refreshOnFocus = true,
    scopeKey,
  }: AutoRefreshOptions = {},
) {
  const refreshRef = useRef(refresh);
  const refreshingRef = useRef(false);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;

    let disposed = false;
    const run = () => {
      if (disposed || refreshingRef.current) return;
      refreshingRef.current = true;
      void refreshRef
        .current()
        .catch(() => undefined)
        .finally(() => {
          refreshingRef.current = false;
        });
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") run();
    };

    run();
    if (refreshOnFocus) {
      window.addEventListener("focus", run);
      document.addEventListener("visibilitychange", onVisibilityChange);
    }
    const intervalId = intervalMs ? window.setInterval(run, intervalMs) : undefined;

    return () => {
      disposed = true;
      if (intervalId !== undefined) window.clearInterval(intervalId);
      if (refreshOnFocus) {
        window.removeEventListener("focus", run);
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
    };
  }, [enabled, intervalMs, refreshOnFocus, scopeKey]);
}
