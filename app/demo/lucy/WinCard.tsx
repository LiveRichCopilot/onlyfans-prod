import type { Win } from "@/lib/lucy-insights";

function fmtUSD(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDateTime(d: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function fmtTime(d: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

const TYPE_LABELS: Record<string, string> = {
  tip: "Tip",
  message: "PPV message",
  post: "Post purchase",
  stream: "Stream",
  subscription: "Subscription",
  referral: "Referral",
  unknown: "Sale",
};

export function WinCard({ win }: { win: Win }) {
  return (
    <details className="group glass-card rounded-2xl overflow-hidden">
      <summary className="cursor-pointer list-none px-4 sm:px-5 py-4 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-semibold text-teal-300 tracking-tight">
              {fmtUSD(win.amount)}
            </span>
            <span className="text-xs text-white/50">{TYPE_LABELS[win.type] || win.type}</span>
          </div>
          <div className="mt-0.5 text-xs text-white/50 truncate">
            Fan #{win.fanNumber} · {fmtDateTime(win.date)}
          </div>
        </div>
        <svg
          className="w-4 h-4 text-white/40 shrink-0 transition-transform group-open:rotate-180"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </summary>

      <div className="px-4 sm:px-5 pb-5 pt-1 space-y-2">
        {win.messages.length === 0 && (
          <div className="text-xs text-white/40 py-3">No preceding messages captured.</div>
        )}
        {win.messages.map((m, i) => {
          const isLucy = m.isFromCreator;
          const hasPPV = m.price > 0;
          return (
            <div key={i} className={`flex ${isLucy ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[80%]">
                <div
                  className={`px-3.5 py-2.5 rounded-2xl text-[15px] leading-snug ${
                    isLucy
                      ? "glass-prominent text-white rounded-br-md"
                      : "glass-inset text-white/90 rounded-bl-md"
                  }`}
                >
                  {m.text || <span className="italic text-white/40">[media]</span>}
                  {hasPPV && (
                    <div className="mt-1.5 inline-block text-[10px] uppercase tracking-wider text-teal-300 border border-teal-400/30 rounded-full px-2 py-0.5">
                      PPV {fmtUSD(m.price)}
                    </div>
                  )}
                  {m.isTip && m.tipAmount > 0 && (
                    <div className="mt-1.5 inline-block text-[10px] uppercase tracking-wider text-teal-300 border border-teal-400/30 rounded-full px-2 py-0.5">
                      Tip {fmtUSD(m.tipAmount)}
                    </div>
                  )}
                </div>
                <div
                  className={`mt-0.5 text-[10px] text-white/30 ${
                    isLucy ? "text-right" : "text-left"
                  }`}
                >
                  {isLucy ? "Lucy" : `Fan #${win.fanNumber}`} · {fmtTime(m.sentAt)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}
