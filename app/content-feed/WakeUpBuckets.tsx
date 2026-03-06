"use client";

function formatNum(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

const ALL_BUCKETS = ["30","60","90","120","150","180","210","240","270","300","330","360","420","480","540","600","660","720","840","960","1080","1200","1320","1440"];
const BUCKET_LABELS: Record<string, string> = {
  "30": "30m", "60": "1h", "90": "1:30", "120": "2h", "150": "2:30",
  "180": "3h", "210": "3:30", "240": "4h", "270": "4:30", "300": "5h",
  "330": "5:30", "360": "6h", "420": "7h", "480": "8h", "540": "9h",
  "600": "10h", "660": "11h", "720": "12h", "840": "14h", "960": "16h",
  "1080": "18h", "1200": "20h", "1320": "22h", "1440": "24h",
};

type Props = {
  buckets: Record<string, number>;
  totalReplied: number;
  ageHours: number;
  purchasedCount: number;
  purchaseBuckets: Record<string, number> | null;
};

export default function WakeUpBuckets({ buckets, totalReplied, ageHours, purchasedCount, purchaseBuckets }: Props) {
  const ageMins = ageHours * 60;
  const visible = ALL_BUCKETS.filter((k) => Number(k) <= ageMins + 30);
  const keys = visible.length < 4 ? ALL_BUCKETS.slice(0, 4) : visible;

  // Wake-up: incremental (new fans per bucket)
  const wakeIncremental = keys.map((k, i) => {
    const cum = Number(buckets[k] || 0);
    const prev = i > 0 ? Number(buckets[keys[i - 1]] || 0) : 0;
    return Math.max(cum - prev, 0);
  });

  // Purchases: incremental (new purchases per bucket)
  const purchaseIncremental = keys.map((k, i) => {
    if (!purchaseBuckets) return 0;
    const cum = Number(purchaseBuckets[k] || 0);
    const prev = i > 0 ? Number(purchaseBuckets[keys[i - 1]] || 0) : 0;
    return Math.max(cum - prev, 0);
  });

  const coldReplied = Math.max(...keys.map((k) => Number(buckets[k] || 0)), 0);
  const totalPurchases = purchaseBuckets ? Math.max(...keys.map((k) => Number(purchaseBuckets[k] || 0)), 0) : 0;
  const maxC = Math.max(...wakeIncremental, ...purchaseIncremental, 1);

  const labelAt = new Set(["30","60","120","180","240","360","480","720","1440"]);
  const showLabel = (k: string) => labelAt.has(k);

  return (
    <div>
      <div className="flex gap-px items-end" style={{ height: 36 }}>
        {keys.map((k, i) => {
          const wakeCount = wakeIncremental[i];
          const purchCount = purchaseIncremental[i];
          const total = wakeCount + purchCount;
          const wakeHPct = Math.max((wakeCount / maxC) * 100, wakeCount > 0 ? 12 : 0);
          const purchHPct = Math.max((purchCount / maxC) * 100, purchCount > 0 ? 12 : 0);
          const emptyH = total === 0 ? 3 : 0;
          return (
            <div key={k} className="flex-1 flex flex-col items-center min-w-0">
              {purchCount > 0 && <span className="text-[8px] font-bold mb-px text-green-400">{purchCount}</span>}
              {purchCount === 0 && wakeCount > 0 && <span className="text-[8px] font-bold mb-px text-white">{wakeCount}</span>}
              <div className="w-full flex flex-col items-stretch">
                {purchCount > 0 && (
                  <div className="w-full rounded-t-sm bg-green-500/60" style={{ height: `${purchHPct}%`, minHeight: 3 }} />
                )}
                {wakeCount > 0 && (
                  <div className={`w-full ${purchCount > 0 ? "" : "rounded-t-sm"} bg-yellow-500/50`} style={{ height: `${wakeHPct}%`, minHeight: 2 }} />
                )}
                {total === 0 && <div className="w-full bg-white/[0.04]" style={{ height: emptyH, minHeight: 1 }} />}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1">
        {keys.map((k) => (
          showLabel(k) ? <span key={k} className="text-[7px] text-white/50">{BUCKET_LABELS[k]}</span> : <span key={k} />
        ))}
      </div>
      <div className="flex items-center gap-3 mt-1">
        {totalPurchases > 0 && (
          <span className="text-[8px] text-green-400 font-semibold">{totalPurchases} bought</span>
        )}
        <span className="text-[8px] text-white/60">
          {formatNum(coldReplied)} cold fans replied · {formatNum(totalReplied)} total
        </span>
      </div>
    </div>
  );
}
