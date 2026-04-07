"use client";

import { useState } from "react";

export function SetupButton({ compact = false }: { compact?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runSetup() {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const r = await fetch("/api/sora/connect-to-models", { method: "POST" });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || `${r.status}`);
      setResult(
        `${json.modelsFound} models connected. ${json.links.filter((l: any) => l.created).length} new links created.`
      );
      setTimeout(() => window.location.reload(), 1500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={compact ? "" : "inline-flex flex-col items-center gap-2"}>
      <button
        onClick={runSetup}
        disabled={loading}
        className={
          "px-4 py-2 rounded-xl font-semibold text-sm transition " +
          "bg-teal-500 hover:bg-teal-400 text-black disabled:opacity-50 disabled:cursor-not-allowed"
        }
      >
        {loading ? "Running setup…" : compact ? "Run Setup" : "Run Setup (Admin)"}
      </button>
      {result && <div className="text-[11px] text-teal-400">{result}</div>}
      {error && <div className="text-[11px] text-red-400">{error}</div>}
    </div>
  );
}
