"use client";

import { UserCircle } from "lucide-react";
import type { Chat } from "./types";

type Props = {
    chat: Chat;
    isActive: boolean;
    onClick: () => void;
};

export function FanRow({ chat, isActive, onClick }: Props) {
    return (
        <div
            onClick={onClick}
            className={`flex items-start p-4 cursor-pointer border-b border-white/5 transition-colors ${isActive ? 'bg-white/10 border-l-2 border-l-teal-500' : 'hover:bg-white/5 border-l-2 border-l-transparent'}`}
        >
            <div className="w-11 h-11 rounded-full bg-white/10 flex-shrink-0 flex items-center justify-center overflow-hidden mr-3 border border-white/10 shadow-sm">
                {chat.withUser.avatar ? (
                    <img src={`/api/proxy-media?url=${encodeURIComponent(chat.withUser.avatar)}`} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                    <UserCircle size={24} className="text-white/30" />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                    <h3 className="font-semibold text-sm truncate text-white/90">{chat.withUser.name} <span className="text-xs text-white/40 font-normal">@{chat.withUser.username}</span></h3>
                    <span className="text-[10px] text-gray-500 flex-shrink-0 ml-2">
                        {chat.lastMessage.createdAt ? new Date(chat.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                </div>
                <div className="flex items-center text-xs">
                    {chat.totalSpend !== undefined && chat.totalSpend > 0 ? (
                        <span className="text-[#14b8a6] font-semibold mr-2">${chat.totalSpend}</span>
                    ) : null}
                    <p className="text-gray-400 truncate w-full">{chat.lastMessage.text}</p>
                </div>
            </div>
        </div>
    );
}
