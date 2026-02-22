"use client";

import { MessageSquare } from "lucide-react";

type Props = {
    creatorName: string;
    chatterTarget: number;
    onChatterTargetChange: (value: number) => void;
    onSave: () => void;
};

export function ChatterTargetModule({ creatorName, chatterTarget, onChatterTargetChange, onSave }: Props) {
    return (
        <div className="glass-panel p-6 rounded-3xl border-l-4 border-l-purple-500 bg-gradient-to-r from-purple-900/10 to-transparent">
            <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <MessageSquare size={18} className="text-purple-400" /> Chatter Target
                </h3>
                <span className="bg-purple-500/20 text-purple-400 px-2.5 py-1 rounded-lg text-xs font-bold">ACTIVE</span>
            </div>
            <p className="text-sm text-white/70 max-w-3xl leading-relaxed mb-4">
                Monitors live revenue pacing for {creatorName}. If the chatter fails to make <strong className="text-white">${chatterTarget} in the last hour</strong>, sends an urgent alarm to shift managers.
            </p>
            <div className="bg-black/30 w-full sm:w-80 rounded-xl p-4 border border-white/5">
                <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">Hourly Minimum</label>
                    <span className="text-xs text-purple-400 font-medium">${chatterTarget}/hr</span>
                </div>
                <input
                    type="range" min="10" max="500" step="10"
                    value={chatterTarget}
                    onChange={(e) => onChatterTargetChange(Number(e.target.value))}
                    onMouseUp={onSave}
                    onTouchEnd={onSave}
                    className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
            </div>
        </div>
    );
}
