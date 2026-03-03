"use client";

import { useState } from "react";
import { Clock, X, AlertCircle } from "lucide-react";
const DURATIONS = [
  { label: "1h", hours: 1 },
  { label: "4h", hours: 4 },
  { label: "8h", hours: 8 },
  { label: "12h", hours: 12 },
];

export function AddOverrideForm({ creators, chatters, onClose, onCreated }: {
  creators: { id: string; name: string | null }[];
  chatters: { email: string; name: string }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [creatorId, setCreatorId] = useState("");
  const [chatterEmail, setChatterEmail] = useState("");
  const [duration, setDuration] = useState("4h");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!creatorId || !chatterEmail) {
      setError("Select both a creator and chatter");
      return;
    }
    setSubmitting(true);
    setError(null);

    const hours = DURATIONS.find(d => d.label === duration)?.hours || 4;
    const startAt = new Date();
    const endAt = new Date(startAt.getTime() + hours * 3600000);

    try {
      const res = await fetch("/api/team-analytics/assignment-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorId, chatterEmail,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          reason: reason || null,
          createdBy: "admin",
        }),
      });

      if (res.status === 409) {
        const d = await res.json();
        setError(`Overlap: ${d.existingOverride?.chatterEmail} assigned until ${new Date(d.existingOverride?.endAt).toLocaleTimeString()}`);
        setSubmitting(false);
        return;
      }
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      onCreated();
    } catch (e: any) {
      setError(e.message);
    }
    setSubmitting(false);
  }

  return (
    <div className="border-t border-white/5 px-6 py-4 bg-white/[0.02]">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-orange-400 flex items-center gap-1.5">
          <Clock size={14} /> Add Override
        </h4>
        <button onClick={onClose} className="text-white/30 hover:text-white/60"><X size={14} /></button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <select value={creatorId} onChange={e => setCreatorId(e.target.value)}
          className="glass-button rounded-xl px-3 py-2 text-xs text-white/70 bg-transparent border border-white/10 appearance-none">
          <option value="" className="bg-[#111]">Select Creator</option>
          {creators.map(c => <option key={c.id} value={c.id} className="bg-[#111]">{c.name || c.id}</option>)}
        </select>

        <select value={chatterEmail} onChange={e => setChatterEmail(e.target.value)}
          className="glass-button rounded-xl px-3 py-2 text-xs text-white/70 bg-transparent border border-white/10 appearance-none">
          <option value="" className="bg-[#111]">Select Chatter</option>
          {chatters.map(c => <option key={c.email} value={c.email} className="bg-[#111]">{c.name}</option>)}
        </select>

        <div className="flex gap-1">
          {DURATIONS.map(d => (
            <button key={d.label} onClick={() => setDuration(d.label)}
              className={`flex-1 rounded-lg px-2 py-2 text-xs font-medium transition ${
                duration === d.label ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" : "glass-button text-white/40"
              }`}>
              {d.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason..."
            className="flex-1 glass-button rounded-xl px-3 py-2 text-xs text-white/70 bg-transparent border border-white/10 placeholder:text-white/20" />
          <button onClick={submit} disabled={submitting}
            className="glass-prominent rounded-xl px-4 py-2 text-xs font-medium text-white disabled:opacity-50">
            {submitting ? "..." : "Apply"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-2 text-red-400 text-xs flex items-center gap-1">
          <AlertCircle size={10} /> {error}
        </div>
      )}
    </div>
  );
}
