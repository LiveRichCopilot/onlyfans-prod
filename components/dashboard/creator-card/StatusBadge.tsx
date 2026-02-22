"use client";

type Props = {
    isActive: boolean;
};

export function StatusBadge({ isActive }: Props) {
    return (
        <div className="flex items-center gap-1.5 relative z-10">
            <span className={`w-2 h-2 rounded-full ${isActive ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" : "bg-white/20"}`} />
            <span className={`text-xs font-medium ${isActive ? "text-emerald-400" : "text-white/30"}`}>
                {isActive ? "Active" : "Offline"}
            </span>
        </div>
    );
}
