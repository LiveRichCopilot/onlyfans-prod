"use client";

import { useEffect, useState } from "react";
import { Models } from "./Models";
import { MassMessageStatistics } from "./MassMessageStatistics";
import { SetupButton } from "./SetupButton";

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
  lastUsedAt: string;
  firstUsedAt: string;
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
  thumbnailUrl: string | null;
};

export type Suggested = {
  priceDollars: number;
  reason: string;
  stat: string;
  lastUsedAt: string | null;
};

export type Pattern = {
  title: string;
  detail: string;
};

export type PaidMass = {
  id: string;
  externalId: string;
  sentAt: string;
  priceDollars: number;
  sends: number;
  purchases: number;
  earned: number;
  caption: string;
  thumbnailUrl: string | null;
};

export type PricePointsResponse = {
  model: { id: string; name: string | null; ofUsername: string | null };
  windowDays: number;
  startDate: string;
  endDate: string;
  paidMassCount: number;
  rowsMissingPrice: number;
  totalSends: number;
  totalPurchases: number;
  totalEarned: number;
  paidMasses: PaidMass[];
  pricePoints: PricePoint[];
  pricePointsNoEarnings: PricePoint[];
  suggestedPricePoints: Suggested[];
  captionsPerformedSuccessfully: Caption[];
  captionsPerformedPoorly: Caption[];
  patterns: Pattern[];
};

export function ContentPlan({
  myModels,
  otherModels,
  isAdmin,
}: {
  myModels: Model[];
  otherModels: Model[];
  isAdmin: boolean;
}) {
  const initialId = myModels[0]?.id || otherModels[0]?.id || null;
  const [selectedId, setSelectedId] = useState<string | null>(initialId);
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

  if (myModels.length === 0 && otherModels.length === 0) {
    return (
      <div className="glass-panel rounded-3xl p-10 text-center space-y-4">
        <p className="text-white/70">
          Your models haven't been linked to your account yet.
        </p>
        {isAdmin ? (
          <div className="space-y-3">
            <p className="text-white/50 text-sm">
              Click Setup to connect Sora, Jay, and David to the 6 models (Kaylie ×2, Anna Cherie ×2, Angie, Wendy).
            </p>
            <SetupButton />
          </div>
        ) : (
          <p className="text-white/50 text-sm">
            Ask Jay or David to run the Setup step for your account.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isAdmin && (
        <div className="flex justify-end">
          <SetupButton compact />
        </div>
      )}
      <Models
        myModels={myModels}
        otherModels={otherModels}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
      <MassMessageStatistics data={data} loading={loading} error={error} />
    </div>
  );
}
