"use client";

export function FilterTabs() {
    return (
        <div className="px-4 py-3 flex gap-2 overflow-x-auto border-b border-white/10 bg-black/10">
            <button className="px-4 py-1.5 bg-teal-500/20 text-teal-400 border border-teal-500/30 rounded-full text-xs font-semibold tracking-wide">All</button>
            <button className="px-4 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors rounded-full text-xs font-semibold text-white/60">Unread</button>
            <button className="px-4 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors rounded-full text-xs font-semibold text-white/60">Super Fans</button>
        </div>
    );
}
