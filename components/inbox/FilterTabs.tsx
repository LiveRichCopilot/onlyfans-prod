"use client";

export function FilterTabs() {
    return (
        <div className="px-4 py-3 flex gap-2 overflow-x-auto border-b border-white/[0.08]">
            <button className="px-4 py-1.5 bg-[#2d786e]/20 text-[#2d786e] border border-[#2d786e]/30 rounded-full text-xs font-semibold tracking-wide">All</button>
            <button className="px-4 py-1.5 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-colors rounded-full text-xs font-semibold text-white/60">Unread</button>
            <button className="px-4 py-1.5 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-colors rounded-full text-xs font-semibold text-white/60">Super Fans</button>
        </div>
    );
}
