"use client";

import { ChevronDown, DollarSign, MessageSquare } from "lucide-react";

type ChatterDmRow = {
  chatter: string;
  sent: number;
  sold: number;
  unsold: number;
  pending: number;
  revenue: number;
  creators: string[];
};

export default function ChatterDmScoreboard({
  stats,
  expanded,
  onToggle,
}: {
  stats: ChatterDmRow[];
  expanded: Set<string>;
  onToggle: (key: string) => void;
}) {
  if (!stats || stats.length === 0) return null;

  const totalSent = stats.reduce((s, r) => s + r.sent, 0);
  const totalSold = stats.reduce((s, r) => s + r.sold, 0);
  const totalRev = stats.reduce((s, r) => s + r.revenue, 0);

  return (
    <div className="glass-card rounded-2xl mb-6 overflow-hidden">
      <button
        onClick={() => onToggle("chatter-dm")}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <span className="text-sm font-semibold text-white flex items-center gap-2">
          <MessageSquare size={14} className="text-purple-400" />
          Chatter DM Sales
          <span className="text-xs text-white/40 font-normal ml-1">
            {totalSold}/{totalSent} sold
            {totalRev > 0 && ` \u2022 $${totalRev.toFixed(0)}`}
          </span>
        </span>
        <ChevronDown
          size={16}
          className={`text-white/50 transition-transform ${expanded.has("chatter-dm") ? "rotate-180" : ""}`}
        />
      </button>
      {expanded.has("chatter-dm") && (
        <div className="px-4 pb-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/50 border-b border-white/5">
                <th className="text-left py-2 pr-4">Chatter</th>
                <th className="text-right py-2 px-2">DMs Sent</th>
                <th className="text-right py-2 px-2">Sold</th>
                <th className="text-right py-2 px-2">Not Sold</th>
                <th className="text-right py-2 px-2">Pending</th>
                <th className="text-right py-2 px-2">Revenue</th>
                <th className="text-right py-2 px-2">Conv %</th>
                <th className="text-left py-2 pl-4">Models</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((row) => {
                const convRate = row.sent > 0 ? Math.round((row.sold / row.sent) * 100) : 0;
                return (
                  <tr
                    key={row.chatter}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02]"
                  >
                    <td className="py-2.5 pr-4 text-purple-400 font-medium">{row.chatter}</td>
                    <td className="py-2.5 px-2 text-right text-white font-semibold">{row.sent}</td>
                    <td className="py-2.5 px-2 text-right text-emerald-400 font-semibold">{row.sold}</td>
                    <td className="py-2.5 px-2 text-right text-red-400">{row.unsold}</td>
                    <td className="py-2.5 px-2 text-right text-yellow-400/70">{row.pending}</td>
                    <td className="py-2.5 px-2 text-right text-emerald-400 flex items-center justify-end gap-0.5">
                      {row.revenue > 0 && <DollarSign size={11} />}
                      {row.revenue > 0 ? row.revenue.toFixed(0) : "-"}
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <span
                        className={`font-semibold ${
                          convRate >= 50
                            ? "text-emerald-400"
                            : convRate >= 20
                            ? "text-yellow-400"
                            : "text-red-400"
                        }`}
                      >
                        {convRate}%
                      </span>
                    </td>
                    <td className="py-2.5 pl-4 text-xs text-white/50 truncate max-w-[150px]">
                      {row.creators.join(", ")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {stats.length > 1 && (
              <tfoot>
                <tr className="border-t border-white/10">
                  <td className="py-2 pr-4 text-white/60 font-medium">Total</td>
                  <td className="py-2 px-2 text-right text-white font-bold">{totalSent}</td>
                  <td className="py-2 px-2 text-right text-emerald-400 font-bold">{totalSold}</td>
                  <td className="py-2 px-2 text-right text-red-400">
                    {stats.reduce((s, r) => s + r.unsold, 0)}
                  </td>
                  <td className="py-2 px-2 text-right text-yellow-400/70">
                    {stats.reduce((s, r) => s + r.pending, 0)}
                  </td>
                  <td className="py-2 px-2 text-right text-emerald-400 font-bold flex items-center justify-end gap-0.5">
                    <DollarSign size={11} />{totalRev.toFixed(0)}
                  </td>
                  <td className="py-2 px-2 text-right text-white/60 font-semibold">
                    {totalSent > 0 ? Math.round((totalSold / totalSent) * 100) : 0}%
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
