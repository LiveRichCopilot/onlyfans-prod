"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Zap, ChevronUp, ChevronDown, Plus, AlertCircle } from "lucide-react";
import { WiringGraph, type WiringNode } from "./WiringGraph";
import { AddOverrideForm } from "./AddOverrideForm";

export function WiringPanel() {
  const [nodes, setNodes] = useState<WiringNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [showOverride, setShowOverride] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/team-analytics/wiring");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setNodes(json.nodes || []);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const i = setInterval(load, 30000); return () => clearInterval(i); }, [load]);

  const liveCount = nodes.filter(n => n.chatter?.source === "live").length;
  const overrideCount = nodes.filter(n => n.chatter?.source === "override").length;
  const unassigned = nodes.filter(n => !n.chatter).length;

  return (
    <div className="glass-card rounded-3xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <Zap size={16} className="text-teal-400" />
          <div>
            <h3 className="text-white font-semibold text-sm">Wiring</h3>
            <p className="text-white/40 text-[10px]">
              {nodes.length} models ·
              <span className="text-teal-400"> {liveCount} live</span>
              {overrideCount > 0 && <span className="text-orange-400"> · {overrideCount} overrides</span>}
              {unassigned > 0 && <span className="text-red-400/60"> · {unassigned} empty</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Legend */}
          <div className="hidden sm:flex items-center gap-3 mr-2">
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded bg-teal-400" /><span className="text-[9px] text-white/30">LIVE</span></span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded bg-orange-400" /><span className="text-[9px] text-white/30">OVERRIDE</span></span>
          </div>
          <button onClick={() => setShowOverride(!showOverride)} className="glass-button rounded-xl px-2.5 py-1 text-[10px] font-medium text-orange-400 hover:text-orange-300 flex items-center gap-1">
            <Plus size={10} /> Override
          </button>
          <button onClick={load} className="glass-button rounded-xl p-1.5 text-white/40 hover:text-white">
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={() => setCollapsed(!collapsed)} className="glass-button rounded-xl p-1.5 text-white/40 hover:text-white">
            {collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </button>
        </div>
      </div>

      {error && <div className="px-6 py-2 text-red-400 text-xs">Error: {error}</div>}

      {!collapsed && <WiringGraph nodes={nodes} />}

      {showOverride && !collapsed && (
        <AddOverrideForm
          creators={nodes.map(n => ({ id: n.id, name: n.name }))}
          chatters={nodes.filter(n => n.chatter).map(n => ({ email: n.chatter!.email, name: n.chatter!.name }))}
          onClose={() => setShowOverride(false)}
          onCreated={() => { setShowOverride(false); load(); }}
        />
      )}
    </div>
  );
}
