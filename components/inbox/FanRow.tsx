"use client";

import type { Chat } from "./types";

type Props = {
    chat: Chat;
    isActive: boolean;
    onClick: () => void;
    showCreatorBadge?: boolean;
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

// Short creator name for the badge (first name only)
function shortName(name: string): string {
    if (!name) return "?";
    const first = name.replace(/[^\w\s]/g, "").trim().split(/\s+/)[0];
    return first.length > 10 ? first.substring(0, 10) : first;
}

export function FanRow({ chat, isActive, onClick, showCreatorBadge }: Props) {
    const isUnread = !chat.lastMessage.isRead;
    const avatarUrl = chat.withUser.avatar
        ? `/api/proxy-media?url=${encodeURIComponent(chat.withUser.avatar)}`
        : null;
    const spend = chat.totalSpend ?? 0;

    return (
        <div
            onClick={onClick}
            className={`flex items-center px-4 py-3 cursor-pointer transition-colors ${
                isActive
                    ? "bg-[#2d786e]/15"
                    : "hover:bg-white/[0.04] active:bg-white/[0.08]"
            }`}
        >
            {/* Avatar */}
            <div className="relative w-12 h-12 flex-shrink-0 mr-3">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-white/[0.08] flex items-center justify-center">
                    {avatarUrl ? (
                        <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-lg font-semibold text-white/30">
                            {chat.withUser.name?.charAt(0)?.toUpperCase() || "?"}
                        </span>
                    )}
                </div>
                {/* Creator avatar badge — shows which model this chat belongs to */}
                {showCreatorBadge && chat._creatorAvatar && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full overflow-hidden border-2 border-[#2d2d2d]">
                        <img src={`/api/proxy-media?url=${encodeURIComponent(chat._creatorAvatar)}`} alt="" className="w-full h-full object-cover" />
                    </div>
                )}
            </div>

            {/* Name + spend + preview */}
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                    <h3 className={`text-[15px] truncate ${isUnread ? "font-semibold text-white" : "font-medium text-white/80"}`}>
                        {chat.withUser.name || `@${chat.withUser.username}`}
                    </h3>
                    <span className={`text-[11px] flex-shrink-0 ml-2 ${isUnread ? "text-[#2d786e]" : "text-white/30"}`}>
                        {chat.lastMessage.createdAt ? timeAgo(chat.lastMessage.createdAt) : ""}
                    </span>
                </div>
                <div className="flex items-center mt-0.5">
                    {spend > 0 && (
                        <span className="text-[11px] text-[#834aa4] font-semibold mr-1.5 flex-shrink-0">
                            ${spend.toLocaleString()}
                        </span>
                    )}
                    <p className={`text-[13px] truncate ${isUnread ? "text-white/60" : "text-white/35"}`}>
                        {chat.lastMessage.text}
                    </p>
                </div>
            </div>

            {/* Unread dot */}
            {isUnread && (
                <div className="w-2.5 h-2.5 rounded-full bg-[#2d786e] flex-shrink-0 ml-2" />
            )}
        </div>
    );
}
