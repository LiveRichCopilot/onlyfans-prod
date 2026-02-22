"use client";

import { Activity, Eye, EyeOff, MoreHorizontal } from "lucide-react";
import type { Chat } from "./types";

type Props = {
    chat: Chat;
    isSfw: boolean;
    onToggleSfw: () => void;
};

export function ChatTopBar({ chat, isSfw, onToggleSfw }: Props) {
    return (
        <div className="h-16 px-6 border-b border-white/10 flex items-center justify-between shrink-0 bg-black/20 backdrop-blur-md">
            <div className="flex items-center">
                <h2 className="font-semibold text-lg tracking-wide text-white/95">{chat.withUser.name} <span className="text-sm font-normal text-white/40 ml-1">@{chat.withUser.username}</span></h2>
            </div>
            <div className="flex items-center gap-4 text-white/50">
                <button onClick={onToggleSfw} className={`transition-colors p-2 rounded-lg hover:bg-white/10 ${isSfw ? 'text-teal-400 bg-teal-500/10' : 'hover:text-white'}`} title="Toggle Safe For Work Mode">
                    {isSfw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
                <button className="p-2 rounded-lg hover:bg-white/10 hover:text-white transition-colors"><Activity size={18} /></button>
                <button className="p-2 rounded-lg hover:bg-white/10 hover:text-white transition-colors"><MoreHorizontal size={18} /></button>
            </div>
        </div>
    );
}
