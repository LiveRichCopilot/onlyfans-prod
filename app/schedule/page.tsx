"use client";

import { ArrowLeft, Calendar } from "lucide-react";
import Link from "next/link";
import { ShiftScheduler } from "@/components/team-analytics/ShiftScheduler";

export default function SchedulePage() {
  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <header className="flex items-center gap-3">
        <Link href="/" className="glass-button rounded-xl p-2 text-white/40 hover:text-white">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Calendar size={22} className="text-[#5B9BD5]" /> Shift Schedule
          </h1>
          <p className="text-white/40 text-sm">Drag chatters onto model shift slots</p>
        </div>
      </header>

      {/* Scheduler */}
      <ShiftScheduler />
    </div>
  );
}
