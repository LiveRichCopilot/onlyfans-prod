"use client";

import { useEffect, useState } from "react";
import { Models } from "./Models";
import { MassMessageStatistics } from "./MassMessageStatistics";

type Model = {
  id: string;
  name: string;
  ofUsername: string | null;
  avatarUrl: string | null;
};

export type PricePoint = {
  priceDollars: number;
  massesSent: number;
  sends: number;
  purchases: number;
  earned: number;
  earnedPerSend: number;
  purchaseRate: number;
};

export type Caption = {
  text: string;
  timesUsed: number;
  sends: number;
  purchases: number;
  earned: number;
  earnedPerSend: number;
  lastUsed: string;
  lastPriceDollars: number | null;
};

export type PricePointsResponse = {
  model: { id: string; name: string | null; ofUsername: string | null };
  windowDays: number;
  startDate: string;
  endDate: string;
  paidMassCount: number;
  totalSends: number;
  totalPurchases: number;
  totalEarned: number;
  pricePoints: PricePoint[];
  captionsPerformedSuccessfully: Caption[];
  captionsPerformedPoorly: Caption[];
};

export function ContentPlan({ models }: { models: Model[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(models[0]?.id || null);
  const [data, setData] = useState<PricePointsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/sora/price-points?modelId=${encodeURIComponent(selectedId)}&days=14`, {
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
        return r.json();
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  if (models.length === 0) {
    return (
      <div className="glass-panel rounded-3xl p-10 text-center">
        <p className="text-white/60">No models connected yet. Ask an admin to run the setup step.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Models models={models} selectedId={selectedId} onSelect={setSelectedId} />
      <MassMessageStatistics data={data} loading={loading} error={error} />
    </div>
  );
}
