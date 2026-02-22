"use client";

import { ChevronLeft, Eye, EyeOff, Phone, Video } from "lucide-react";
import type { Chat } from "./types";

type Props = {
    chat: Chat;
    isSfw: boolean;
    onToggleSfw: () => void;
    onBack?: () => void;
};

export function ChatTopBar({ chat, isSfw, onToggleSfw, onBack }: Props) {
    const avatarUrl = chat.withUser.avatar
        ? `/api/proxy-media?url=${encodeURIComponent(chat.withUser.avatar)}`
        : null;

    return (
        <div className="h-14 px-3 md:px-5 border-b border-white/[0.06] flex items-center justify-between shrink-0 bg-white/[0.02] backdrop-blur-xl">
            <div className="flex items-center gap-2">
                {/* Back button — visible on mobile */}
                {onBack && (
                    <button onClick={onBack} className="md:hidden p-1.5 -ml-1 text-[#007AFF] hover:bg-white/5 rounded-lg transition-colors">
                        <ChevronLeft size={24} />
                    </button>
                )}

                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-white/10 flex-shrink-0 flex items-center justify-center overflow-hidden border border-white/[0.08]">
                    {avatarUrl ? (
                        <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-sm font-semibold text-white/40">
                            {chat.withUser.name?.charAt(0)?.toUpperCase() || "?"}
                        </span>
                    )}
                </div>

                {/* Name + status */}
                <div className="min-w-0">
                    <h2 className="font-semibold text-sm text-white/95 truncate">{chat.withUser.name}</h2>
                    <p className="text-[11px] text-white/35 truncate">@{chat.withUser.username}</p>
                </div>
            </div>

            <div className="flex items-center gap-1">
                <button
                    onClick={onToggleSfw}
                    className={`p-2 rounded-full transition-colors ${isSfw ? "text-[#007AFF] bg-[#007AFF]/10" : "text-white/40 hover:text-white/60 hover:bg-white/5"}`}
                    title={isSfw ? "SFW Mode On" : "SFW Mode Off"}
                >
                    {isSfw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
                <button className="p-2 rounded-full text-white/40 hover:text-white/60 hover:bg-white/5 transition-colors">
                    <Phone size={18} />
                </button>
                <button className="p-2 rounded-full text-white/40 hover:text-white/60 hover:bg-white/5 transition-colors">
                    <Video size={18} />
                </button>
            </div>
        </div>
    );
}
