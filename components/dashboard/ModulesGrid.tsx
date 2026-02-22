"use client";

const modules = [
    { id: "NOT-01", title: "Whale Alert", desc: "Push notification when fan crosses tip threshold.", active: true },
    { id: "STF-01", title: "Chatter Monitor", desc: "Alerts when hourly revenue drops below target.", active: true },
    { id: "INT-03", title: "AI Chat Assist", desc: "Suggested responses powered by Claude API.", active: false },
];

export function ModulesGrid() {
    return (
        <div>
            <h2 className="text-lg font-semibold text-white/80 mb-4 px-2">Global Modules</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {modules.map((mod) => (
                    <div
                        key={mod.id}
                        className={`p-6 rounded-3xl backdrop-blur-3xl border-t border-t-white/20 border-l border-l-white/10 flex flex-col justify-between transition-all duration-500
                            ${mod.active
                                ? "bg-gradient-to-br from-white/10 to-white/5 shadow-2xl shadow-blue-500/10"
                                : "bg-black/20 border border-white/5 opacity-70"}`}
                    >
                        <div>
                            <div className="flex justify-between items-center mb-5">
                                <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-lg bg-white/10 text-white/90 shadow-inner">
                                    {mod.id}
                                </span>
                                <div className={`h-2.5 w-2.5 rounded-full ${mod.active ? "bg-teal-400 shadow-md shadow-teal-500/80" : "bg-white/20"}`} />
                            </div>
                            <h3 className="text-xl font-semibold tracking-tight text-white mb-2">{mod.title}</h3>
                            <p className="text-sm text-white/50 leading-relaxed font-medium">{mod.desc}</p>
                        </div>
                        <button className={`mt-6 w-full py-2.5 rounded-xl text-sm font-semibold transition active:scale-95
                            ${mod.active ? "bg-white/10 text-white hover:bg-white/20 border border-white/10" : "bg-white text-black hover:bg-white/90"}`}>
                            {mod.active ? "Configure" : "Enable API"}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
