"use client";

import { ShieldCheck } from "lucide-react";

type Props = {
    creatorName: string;
    telegramGroupId: string | null;
    whaleTarget: number;
    onWhaleTargetChange: (value: number) => void;
    onSave: () => void;
};

export function WhaleWatcherModule({ creatorName, telegramGroupId, whaleTarget, onWhaleTargetChange, onSave }: Props) {
    return (
        <div className="glass-panel p-6 rounded-3xl border-l-4 border-l-teal-500 bg-gradient-to-r from-teal-900/10 to-transparent">
            <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <ShieldCheck size={18} className="text-teal-400" /> Whale Watcher
                </h3>
                <span className="bg-teal-500/20 text-teal-400 px-2.5 py-1 rounded-lg text-xs font-bold">ACTIVE</span>
            </div>
            <p className="text-sm text-white/70 max-w-3xl leading-relaxed mb-4">
                Scans {creatorName}'s transactions. If a fan tips more than <strong className="text-white">${whaleTarget}</strong> in a single day, sends a priority alert to Telegram Group (<code className="bg-black/40 px-1 py-0.5 rounded text-teal-300 text-xs">{telegramGroupId || 'Agency Default Feed'}</code>).
            </p>
            <div className="bg-black/30 w-full sm:w-80 rounded-xl p-4 border border-white/5">
                <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">Trigger Threshold</label>
                    <span className="text-xs text-teal-400 font-medium">${whaleTarget}/day</span>
                </div>
                <input
                    type="range" min="0" max="1000" step="50"
                    value={whaleTarget}
                    onChange={(e) => onWhaleTargetChange(Number(e.target.value))}
                    onMouseUp={onSave}
                    onTouchEnd={onSave}
                    className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-teal-500"
                />
            </div>
        </div>
    );
}
