"use client";

import type { Chat } from "./types";

type Props = {
    chat: Chat;
};

export function FanInfo({ chat }: Props) {
    return (
        <div className="bg-black/20 border border-white/10 rounded-2xl p-4">
            <h4 className="text-sm font-bold tracking-tight text-white/90 mb-4">Info</h4>
            <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                    <span className="text-white/50">Fan since</span>
                    <span className="text-white/80">-</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-white/50">Total spend</span>
                    <span className="font-bold text-teal-400">${chat.totalSpend || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-white/50">Last paid</span>
                    <span className="text-white/80">-</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-white/50">Came from</span>
                    <span className="text-white/80">-</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-white/50">Location</span>
                    <span className="text-white/80">-</span>
                </div>
            </div>
            <div className="flex justify-between items-center bg-white/5 -mx-4 -mb-4 mt-4 px-4 py-3 rounded-b-2xl border-t border-white/5">
                <span className="text-white/50 text-xs">Last seen parsing</span>
                <span className="text-xs text-white/80 flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,1)]"></div>Live Feed</span>
            </div>
        </div>
    );
}
