"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Zap, Plus, AlertCircle } from "lucide-react";
import { WiringGraph } from "./WiringGraph";
import { AddOverrideForm } from "./AddOverrideForm";

export type WiringCreator = { id: string; name: string | null; ofUsername: string | null; avatarUrl: string | null };
export type WiringChatter = { email: string; name: string };
export type WiringConnection = { chatterEmail: string; creatorId: string; source: "override" | "live" | "scheduled"; detail?: string };
export type WiringData = { creators: WiringCreator[]; chatters: WiringChatter[]; connections: WiringConnection[] };

export function WiringPanel() {
  const [data, setData] = useState<WiringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOverride, setShowOverride] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/team-analytics/wiring");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const i = setInterval(load, 30000); return () => clearInterval(i); }, [load]);

  if (loading && !data) {
    return (
      <div className="glass-card rounded-3xl p-8 flex items-center justify-center">
        <RefreshCw size={16} className="animate-spin text-teal-400 mr-2" />
        <span className="text-white/40 text-sm">Loading wiring...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="glass-card rounded-3xl p-6">
        <div className="text-red-400 text-sm flex items-center gap-2"><AlertCircle size={14} /> {error}</div>
      </div>
    );
  }

  const liveCount = data.connections.filter(c => c.source === "live").length;
  const overrideCount = data.connections.filter(c => c.source === "override").length;

  return (
    <div className="glass-card rounded-3xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <Zap size={18} className="text-teal-400" />
          <div>
            <h3 className="text-white font-semibold text-sm">Creator ↔ Chatter Wiring</h3>
            <p className="text-white/40 text-xs">
              {data.creators.length} creators · {data.chatters.length} chatters
              {liveCount > 0 && <span className="text-teal-400"> · {liveCount} live</span>}
              {overrideCount > 0 && <span className="text-orange-400"> · {overrideCount} overrides</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowOverride(!showOverride)} className="glass-button rounded-xl px-3 py-1.5 text-xs font-medium text-orange-400 hover:text-orange-300 flex items-center gap-1">
            <Plus size={12} /> Override
          </button>
          <button onClick={load} className="glass-button rounded-xl p-2 text-white/40 hover:text-white">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-6 py-2 border-b border-white/5">
        {[
          { color: "#2dd4bf", label: "Live" },
          { color: "#f97316", label: "Override" },
          { color: "#6b7280", label: "Scheduled" },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="w-5 h-0.5 rounded" style={{ backgroundColor: l.color }} />
            <span className="text-[10px] text-white/40 uppercase tracking-wider">{l.label}</span>
          </div>
        ))}
      </div>

      {error && <div className="px-6 py-2 text-red-400 text-xs">Error: {error}</div>}

      <WiringGraph data={data} />

      {showOverride && (
        <AddOverrideForm
          creators={data.creators}
          chatters={data.chatters}
          onClose={() => setShowOverride(false)}
          onCreated={() => { setShowOverride(false); load(); }}
        />
      )}
    </div>
  );
}
