"use client";

type Props = {
    isActive: boolean;
    isUnderperforming: boolean;
};

export function StatusBadge({ isActive, isUnderperforming }: Props) {
    return (
        <div className="flex flex-col items-end gap-1.5 relative z-10">
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
                Live
            </span>
            {isUnderperforming ? (
                <span className="text-red-400 text-[10px]">Below target</span>
            ) : isActive ? (
                <span className="text-emerald-400 text-xs">Active</span>
            ) : (
                <span className="text-white/30 text-xs">Offline</span>
            )}
        </div>
    );
}
