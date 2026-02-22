"use client";

const TOOLS = [
    { label: "Vault", icon: "🗃" },
    { label: "Script", icon: "📝" },
    { label: "PPV", icon: "💰" },
    { label: "Voice", icon: "🎤" },
];

export function ToolsMenu() {
    return (
        <div className="flex gap-2 mt-2 px-1 overflow-x-auto pb-1">
            {TOOLS.map((tool) => (
                <button
                    key={tool.label}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-xs text-white/60 hover:bg-white/[0.1] transition-colors whitespace-nowrap"
                >
                    <span>{tool.icon}</span>
                    <span>{tool.label}</span>
                </button>
            ))}
        </div>
    );
}
