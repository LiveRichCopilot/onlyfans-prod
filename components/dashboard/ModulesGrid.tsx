"use client";

import { ModuleCard } from "./ModuleCard";

const MODULES = [
    { code: "NOT-01", title: "Whale Alert", description: "Push notification when fan crosses tip threshold.", buttonLabel: "Configure", active: true },
    { code: "STF-01", title: "Chatter Monitor", description: "Alerts when hourly revenue drops below target.", buttonLabel: "Configure", active: true },
    { code: "INT-03", title: "AI Chat Assist", description: "Suggested responses powered by Claude API.", buttonLabel: "Enable API", active: false },
];

export function ModulesGrid() {
    return (
        <div>
            <h2 className="text-lg font-semibold text-white/80 mb-4 px-2">Global Modules</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {MODULES.map((m) => (
                    <ModuleCard key={m.code} {...m} />
                ))}
            </div>
        </div>
    );
}
