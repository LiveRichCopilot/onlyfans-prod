"use client";

type Props = {
    code: string;
    title: string;
    description: string;
    buttonLabel: string;
    active?: boolean;
};

export function ModuleCard({ code, title, description, buttonLabel, active = true }: Props) {
    return (
        <div className="glass-panel p-6 rounded-3xl border-t border-t-white/20 border-l border-l-white/10">
            <div className="flex justify-between mb-4">
                <span className="text-[10px] font-bold tracking-wider bg-white/10 text-white/50 px-2 py-0.5 rounded">{code}</span>
                <div className={`w-2 h-2 rounded-full mt-1 ${active ? "bg-teal-400" : "bg-white/20"}`} />
            </div>
            <h3 className="text-lg font-semibold text-white/90 mb-2">{title}</h3>
            <p className="text-sm text-white/50 mb-4">{description}</p>
            <button className="w-full py-2.5 rounded-xl bg-white/5 text-white/60 text-sm font-medium hover:bg-white/10 transition-colors border border-white/10">
                {buttonLabel}
            </button>
        </div>
    );
}
