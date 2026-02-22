"use client";

type Props = {
    isActive: boolean;
};

export function StatusBadge({ isActive }: Props) {
    return (
        <div className="flex flex-col items-end gap-1.5 relative z-10">
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
                Live
            </span>
            <span className={`text-xs ${isActive ? "text-emerald-400" : "text-white/30"}`}>
                {isActive ? "Active" : "Offline"}
            </span>
        </div>
    );
}
