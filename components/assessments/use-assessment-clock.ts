"use client";

import { useEffect, useState } from "react";
import { serverAlignedNow } from "@/lib/assessment-time";

export function useServerAlignedNow(
  serverNow: string | null | undefined,
  receivedAt: number,
  ticking: boolean,
): number {
  const [fallbackReceivedAt] = useState(() => Date.now());
  const [clientNow, setClientNow] = useState(() => Date.now());

  useEffect(() => {
    if (!ticking) return;
    const interval = window.setInterval(() => setClientNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [ticking]);

  return serverAlignedNow(
    serverNow,
    Number.isFinite(receivedAt) && receivedAt > 0
      ? receivedAt
      : fallbackReceivedAt,
    clientNow,
  );
}
