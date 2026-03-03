"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Copy, Calendar } from "lucide-react";
import { SchedulerGrid } from "./SchedulerGrid";
import { ChatterPalette } from "./ChatterPalette";

type Shift = {
  id: string;
  creatorId: string;
  chatterEmail: string;
  chatterName: string | null;
  dayOfWeek: number;
  shiftType: string;
};

type Creator = {
  id: string;
  name: string | null;
  ofUsername: string | null;
  avatarUrl: string | null;
};

type Chatter = { email: string; name: string };

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ShiftScheduler() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [chatters, setChatters] = useState<Chatter[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Copy feature state
  const [copyMode, setCopyMode] = useState<"day" | "shift" | null>(null);
  const [copySourceDay, setCopySourceDay] = useState<number | null>(null);
  const [copySourceShift, setCopySourceShift] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/team-analytics/schedule");
      if (res.ok) {
        const data = await res.json();
        setShifts(data.shifts || []);
        setCreators(data.creators || []);
        setChatters(data.chatters || []);
      }
    } catch {
      // silent
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Assign a chatter to a slot (from palette drag)
  const handleAssign = useCallback(
    async (creatorId: string, chatterEmail: string, chatterName: string, dayOfWeek: number, shiftType: string) => {
      setSaving(true);
      try {
        const res = await fetch("/api/team-analytics/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ creatorId, chatterEmail, chatterName, dayOfWeek, shiftType }),
        });
        if (res.ok) {
          const newShift = await res.json();
          setShifts((prev) => {
            // Remove any existing with same unique key, add new
            const filtered = prev.filter(
              (s) =>
                !(s.creatorId === newShift.creatorId &&
                  s.dayOfWeek === newShift.dayOfWeek &&
                  s.shiftType === newShift.shiftType &&
                  s.chatterEmail === newShift.chatterEmail)
            );
            return [...filtered, newShift];
          });
        }
      } catch {
        // silent
      }
      setSaving(false);
    },
    []
  );

  // Move a shift to a new slot (drag between cells)
  const handleMove = useCallback(
    async (shiftId: string, newCreatorId: string, newDayOfWeek: number, newShiftType: string) => {
      setSaving(true);
      try {
        const res = await fetch("/api/team-analytics/schedule", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: shiftId, newCreatorId, newDayOfWeek, newShiftType }),
        });
        if (res.ok) {
          const updated = await res.json();
          setShifts((prev) => {
            const filtered = prev.filter((s) => s.id !== shiftId);
            return [...filtered, updated];
          });
        }
      } catch {
        // silent
      }
      setSaving(false);
    },
    []
  );

  // Remove a shift
  const handleRemove = useCallback(async (shiftId: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/team-analytics/schedule?id=${shiftId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setShifts((prev) => prev.filter((s) => s.id !== shiftId));
      }
    } catch {
      // silent
    }
    setSaving(false);
  }, []);

  // Copy a day's assignments to all other days
  const handleCopyDayToAll = useCallback(
    async (sourceDay: number) => {
      setSaving(true);
      const sourceShifts = shifts.filter((s) => s.dayOfWeek === sourceDay);
      const otherDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => d !== sourceDay);

      for (const day of otherDays) {
        for (const s of sourceShifts) {
          await fetch("/api/team-analytics/schedule", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              creatorId: s.creatorId,
              chatterEmail: s.chatterEmail,
              chatterName: s.chatterName,
              dayOfWeek: day,
              shiftType: s.shiftType,
            }),
          });
        }
      }
      await load();
      setSaving(false);
      setCopyMode(null);
    },
    [shifts, load]
  );

  // Copy a shift type's assignments to another shift type
  const handleCopyShift = useCallback(
    async (sourceShift: string, targetShift: string) => {
      setSaving(true);
      const sourceShifts = shifts.filter((s) => s.shiftType === sourceShift);

      for (const s of sourceShifts) {
        await fetch("/api/team-analytics/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creatorId: s.creatorId,
            chatterEmail: s.chatterEmail,
            chatterName: s.chatterName,
            dayOfWeek: s.dayOfWeek,
            shiftType: targetShift,
          }),
        });
      }
      await load();
      setSaving(false);
      setCopyMode(null);
    },
    [shifts, load]
  );

  // Current week display label (Tue→Mon)
  const now = new Date();
  const ukNow = new Date(now.toLocaleString("en-GB", { timeZone: "Europe/London" }));
  const currentDow = ukNow.getDay();
  // Find current Tuesday (start of payment week)
  const daysSinceTue = (currentDow + 5) % 7; // days since last Tuesday
  const tue = new Date(ukNow);
  tue.setDate(ukNow.getDate() - daysSinceTue);
  const mon = new Date(tue);
  mon.setDate(tue.getDate() + 6);

  const weekLabel = `${tue.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} – ${mon.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;

  if (loading && shifts.length === 0) {
    return (
      <div className="glass-card rounded-3xl p-8 flex items-center justify-center">
        <RefreshCw className="w-5 h-5 text-[#5B9BD5] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Calendar size={20} className="text-[#5B9BD5]" />
          <div>
            <h2 className="text-lg font-bold text-white">Shift Schedule</h2>
            <p className="text-xs text-white/40">
              Recurring template — {weekLabel} (Tue→Mon)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Copy Day → All */}
          {copyMode === "day" ? (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-white/40">Copy which day?</span>
              {[2, 3, 4, 5, 6, 0, 1].map((dow) => (
                <button
                  key={dow}
                  onClick={() => handleCopyDayToAll(dow)}
                  className="px-2 py-1 rounded-lg text-[10px] font-medium bg-white/5 text-white/60 hover:bg-[#5B9BD5]/20 hover:text-[#5B9BD5] transition"
                >
                  {DAY_LABELS[dow]}
                </button>
              ))}
              <button
                onClick={() => setCopyMode(null)}
                className="text-[10px] text-white/30 hover:text-white/60 ml-1"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCopyMode("day")}
              className="glass-button rounded-xl px-3 py-1.5 text-xs font-medium text-white/60 flex items-center gap-1.5 hover:text-white/80"
            >
              <Copy size={12} /> Copy Day → All
            </button>
          )}

          {/* Refresh */}
          <button
            onClick={load}
            className="glass-button rounded-xl p-2 text-white/40 hover:text-white"
          >
            <RefreshCw size={14} className={loading || saving ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Grid + Palette */}
      <div className="flex gap-4">
        {/* Main Grid */}
        <div className="glass-card rounded-3xl p-4 flex-1 overflow-hidden">
          <SchedulerGrid
            shifts={shifts}
            creators={creators}
            onAssign={handleAssign}
            onMove={handleMove}
            onRemove={handleRemove}
          />
        </div>

        {/* Chatter Palette (right sidebar) */}
        <div className="hidden lg:block w-[220px] flex-shrink-0">
          <ChatterPalette chatters={chatters} shifts={shifts} />
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-6 px-2">
        <span className="text-[11px] text-white/30">
          {creators.length} models
        </span>
        <span className="text-[11px] text-white/30">
          {chatters.length} chatters
        </span>
        <span className="text-[11px] text-white/30">
          {shifts.length} shift assignments
        </span>
        {saving && (
          <span className="text-[11px] text-[#D4A843] flex items-center gap-1">
            <RefreshCw size={10} className="animate-spin" /> Saving...
          </span>
        )}
      </div>
    </div>
  );
}
