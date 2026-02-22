"use client";

import type { Chat } from "./types";

type Props = {
    chat: Chat;
    isActive: boolean;
    onClick: () => void;
};

function timeAgo(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "now";
    if (diffMin < 60) return `${diffMin}m`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function FanRow({ chat, isActive, onClick }: Props) {
    const isUnread = !chat.lastMessage.isRead;
    const avatarUrl = chat.withUser.avatar
        ? `/api/proxy-media?url=${encodeURIComponent(chat.withUser.avatar)}`
        : null;

    return (
        <div
            onClick={onClick}
            className={`flex items-center px-4 py-3 cursor-pointer transition-colors ${
                isActive
                    ? "bg-[#0D9488]/15"
                    : "hover:bg-white/[0.04] active:bg-white/[0.08]"
            }`}
        >
            {/* Avatar */}
            <div className="w-12 h-12 rounded-full flex-shrink-0 overflow-hidden mr-3 bg-white/[0.08] flex items-center justify-center">
                {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                    <span className="text-lg font-semibold text-white/30">
                        {chat.withUser.name?.charAt(0)?.toUpperCase() || "?"}
                    </span>
                )}
            </div>

            {/* Name + preview */}
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                    <h3 className={`text-[15px] truncate ${isUnread ? "font-semibold text-white" : "font-medium text-white/80"}`}>
                        {chat.withUser.name || `@${chat.withUser.username}`}
                    </h3>
                    <span className={`text-[11px] flex-shrink-0 ml-2 ${isUnread ? "text-[#0D9488]" : "text-white/30"}`}>
                        {chat.lastMessage.createdAt ? timeAgo(chat.lastMessage.createdAt) : ""}
                    </span>
                </div>
                <div className="flex items-center mt-0.5">
                    {chat.totalSpend !== undefined && chat.totalSpend > 0 && (
                        <span className="text-[11px] text-emerald-400 font-semibold mr-1.5 flex-shrink-0">
                            ${chat.totalSpend.toLocaleString()}
                        </span>
                    )}
                    <p className={`text-[13px] truncate ${isUnread ? "text-white/60" : "text-white/35"}`}>
                        {chat.lastMessage.text}
                    </p>
                </div>
            </div>

            {/* Unread dot */}
            {isUnread && (
                <div className="w-2.5 h-2.5 rounded-full bg-[#0D9488] flex-shrink-0 ml-2 shadow-lg shadow-blue-500/50" />
            )}
        </div>
    );
}
