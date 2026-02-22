"use client";

import { useState } from "react";

type FilterState = {
    hideRead: boolean;
    hideAIHandled: boolean;
    hideAnswered: boolean;
    hideExpired: boolean;
    hideCreators: boolean;
    hideDeleted: boolean;
    spendMin: string;
    spendMax: string;
    subscribedWithin: string;
};

const defaultFilters: FilterState = {
    hideRead: false,
    hideAIHandled: false,
    hideAnswered: false,
    hideExpired: false,
    hideCreators: false,
    hideDeleted: true,
    spendMin: "",
    spendMax: "",
    subscribedWithin: "all",
};

const timeOptions = ["All Time", "1 Hour", "12 Hours", "1 Day", "7 Days", "30 Days", "90 Days", "1 Year"];

type Props = {
    onApply: (filters: FilterState) => void;
};

export function FilterPanel({ onApply }: Props) {
    const [open, setOpen] = useState(false);
    const [filters, setFilters] = useState<FilterState>(defaultFilters);

    const toggle = (key: keyof FilterState) => {
        setFilters(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const ToggleRow = ({ label, field }: { label: string; field: keyof FilterState }) => (
        <div className="flex justify-between items-center py-2">
            <span className="text-sm text-white/80">{label}</span>
            <button
                onClick={() => toggle(field)}
                className={`w-10 h-5 rounded-full transition-colors relative ${filters[field] ? "bg-purple-500" : "bg-white/20"}`}
            >
                <div className={`w-4 h-4 rounded-full bg-white shadow-md absolute top-0.5 transition-transform ${filters[field] ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
        </div>
    );

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(!open)}
                className={`p-2 rounded-xl transition-colors border ${open ? "bg-teal-500/10 border-teal-500/30 text-teal-400" : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white"}`}
                title="Filters"
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-80 z-40 glass-panel rounded-2xl border border-white/10 p-5 shadow-2xl bg-gray-900/95 backdrop-blur-xl max-h-[80vh] overflow-y-auto custom-scrollbar">
                        <h3 className="text-base font-bold text-white mb-3">Filters</h3>

                        <ToggleRow label="Hide read messages" field="hideRead" />
                        <ToggleRow label="Hide chats handled by AI" field="hideAIHandled" />
                        <ToggleRow label="Hide answered fans" field="hideAnswered" />
                        <ToggleRow label="Hide expired" field="hideExpired" />
                        <ToggleRow label="Hide creators" field="hideCreators" />
                        <ToggleRow label="Hide deleted fans" field="hideDeleted" />

                        {/* Spend Range */}
                        <div className="border-t border-white/10 mt-3 pt-3">
                            <h4 className="text-sm font-bold text-white/90 mb-2">Spend Range</h4>
                            <div className="flex items-center gap-2">
                                <div className="flex-1 flex items-center bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                                    <span className="text-white/40 text-sm mr-1">$</span>
                                    <input type="text" placeholder="Min" value={filters.spendMin} onChange={e => setFilters(prev => ({ ...prev, spendMin: e.target.value }))} className="bg-transparent border-none outline-none text-sm text-white w-full placeholder-white/30" />
                                </div>
                                <span className="text-white/40 text-sm">to</span>
                                <div className="flex-1 flex items-center bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                                    <span className="text-white/40 text-sm mr-1">$</span>
                                    <input type="text" placeholder="Max" value={filters.spendMax} onChange={e => setFilters(prev => ({ ...prev, spendMax: e.target.value }))} className="bg-transparent border-none outline-none text-sm text-white w-full placeholder-white/30" />
                                </div>
                            </div>
                        </div>

                        {/* Subscribed Within */}
                        <div className="border-t border-white/10 mt-3 pt-3">
                            <h4 className="text-sm font-bold text-white/90 mb-2">Subscribed Within</h4>
                            <div className="flex flex-wrap gap-2">
                                {timeOptions.map(opt => {
                                    const val = opt.toLowerCase().replace(/ /g, "_");
                                    return (
                                        <button
                                            key={opt}
                                            onClick={() => setFilters(prev => ({ ...prev, subscribedWithin: val }))}
                                            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${filters.subscribedWithin === val ? "bg-purple-500/20 text-purple-300 border-purple-500/30" : "bg-white/5 text-white/50 border-white/10 hover:bg-white/10"}`}
                                        >
                                            {opt}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Apply Button */}
                        <button
                            onClick={() => { onApply(filters); setOpen(false); }}
                            className="w-full mt-4 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-semibold text-sm transition-colors active:scale-95"
                        >
                            Apply Filters
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
