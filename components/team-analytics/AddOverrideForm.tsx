"use client";

import { useState, useRef, useEffect } from "react";
import { Clock, X, AlertCircle, Check, ChevronDown, Search } from "lucide-react";

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
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [duration, setDuration] = useState("4h");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = chatters.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  function toggleChatter(email: string) {
    setSelectedEmails(prev => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  async function submit() {
    if (!creatorId || selectedEmails.size === 0) {
      setError("Select a creator and at least one chatter");
      return;
    }
    setSubmitting(true);
    setError(null);

    const hours = DURATIONS.find(d => d.label === duration)?.hours || 4;
    const startAt = new Date();
    const endAt = new Date(startAt.getTime() + hours * 3600000);
    const errors: string[] = [];

    for (const chatterEmail of selectedEmails) {
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
          errors.push(`${chatterEmail}: overlap`);
        } else if (!res.ok) {
          errors.push(`${chatterEmail}: HTTP ${res.status}`);
        }
      } catch (e: any) {
        errors.push(`${chatterEmail}: ${e.message}`);
      }
    }

    if (errors.length > 0) {
      setError(errors.join("; "));
    }
    setSubmitting(false);
    if (errors.length < selectedEmails.size) onCreated();
  }

  const selectedNames = chatters
    .filter(c => selectedEmails.has(c.email))
    .map(c => c.name);

  return (
    <div className="border-t border-white/5 px-6 py-4 bg-white/[0.02]">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-orange-400 flex items-center gap-1.5">
          <Clock size={14} /> Add Override
        </h4>
        <button onClick={onClose} className="text-white/30 hover:text-white/60"><X size={14} /></button>
      </div>

      <div className="flex flex-wrap items-start gap-3">
        {/* Creator select */}
        <select value={creatorId} onChange={e => setCreatorId(e.target.value)}
          className="glass-button rounded-xl px-3 py-2 text-xs text-white/70 bg-transparent border border-white/10 appearance-none min-w-[180px]">
          <option value="" className="bg-[#111]">Select Creator</option>
          {creators.map(c => <option key={c.id} value={c.id} className="bg-[#111]">{c.name || c.id}</option>)}
        </select>

        {/* Multi-select chatter dropdown */}
        <div ref={dropRef} className="relative min-w-[220px]">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="glass-button rounded-xl px-3 py-2 text-xs text-white/70 bg-transparent border border-white/10 w-full text-left flex items-center justify-between gap-2"
          >
            <span className="truncate">
              {selectedEmails.size === 0
                ? "Select Chatters"
                : `${selectedEmails.size} selected`}
            </span>
            <ChevronDown size={12} className="text-white/30 shrink-0" />
          </button>

          {/* Selected pills */}
          {selectedNames.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {selectedNames.map(name => (
                <span key={name} className="px-2 py-0.5 rounded-lg bg-teal-500/15 text-teal-400 text-[10px] font-medium">
                  {name}
                </span>
              ))}
            </div>
          )}

          {dropdownOpen && (
            <div className="absolute z-50 top-full mt-1 left-0 w-[260px] max-h-[280px] overflow-hidden rounded-xl border border-white/10 bg-[#111] shadow-2xl flex flex-col">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
                <Search size={12} className="text-white/30" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search..."
                  autoFocus
                  className="flex-1 bg-transparent text-xs text-white/80 outline-none placeholder:text-white/20"
                />
              </div>
              <div className="overflow-y-auto flex-1">
                {filtered.map(c => (
                  <button
                    key={c.email}
                    onClick={() => toggleChatter(c.email)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-white/5 transition ${
                      selectedEmails.has(c.email) ? "text-teal-400" : "text-white/60"
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                      selectedEmails.has(c.email) ? "bg-teal-500/20 border-teal-500/50" : "border-white/20"
                    }`}>
                      {selectedEmails.has(c.email) && <Check size={9} />}
                    </div>
                    <span className="truncate">{c.name}</span>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <div className="px-3 py-4 text-center text-white/20 text-xs">No matches</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Duration buttons */}
        <div className="flex gap-1">
          {DURATIONS.map(d => (
            <button key={d.label} onClick={() => setDuration(d.label)}
              className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                duration === d.label ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" : "glass-button text-white/40"
              }`}>
              {d.label}
            </button>
          ))}
        </div>

        {/* Reason + Submit */}
        <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason..."
          className="glass-button rounded-xl px-3 py-2 text-xs text-white/70 bg-transparent border border-white/10 placeholder:text-white/20 min-w-[120px]" />
        <button onClick={submit} disabled={submitting}
          className="glass-prominent rounded-xl px-4 py-2 text-xs font-medium text-white disabled:opacity-50">
          {submitting ? "..." : `Apply${selectedEmails.size > 1 ? ` (${selectedEmails.size})` : ""}`}
        </button>
      </div>

      {error && (
        <div className="mt-2 text-red-400 text-xs flex items-center gap-1">
          <AlertCircle size={10} /> {error}
        </div>
      )}
    </div>
  );
}
