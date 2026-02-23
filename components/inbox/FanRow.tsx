"use client";

import type { Chat } from "./types";

type Props = {
    chat: Chat;
    isActive: boolean;
    onClick: () => void;
    showCreatorBadge?: boolean;
    _tick?: number; // Temperature ring refresh — triggers re-render every 30s
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

// Spend tier color — used for both the dot and the dollar amount
function spendColor(spend: number): string | null {
    if (spend >= 10000) return "#00ff88"; // neon green — whale, hot buyer
    if (spend >= 5000) return "#22c55e";  // green — great spender
    if (spend >= 1000) return "#86efac";  // light green — solid
    if (spend >= 500) return "#facc15";   // yellow — getting cold
    if (spend >= 100) return "#f59e0b";   // amber — cooling off
    if (spend > 0) return "#ef4444";      // red — at risk
    return null;                           // no spend
}

// Convert hex color + alpha to rgba string
function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Fan temperature — ring color based on how recently they spent money
// Returns null = never bought (no ring)
function fanTemperature(lastPurchaseAt?: string): { color: string; opacity: number; glow: boolean } | null {
    if (!lastPurchaseAt) return null;
    const msAgo = Date.now() - new Date(lastPurchaseAt).getTime();
    const minAgo = msAgo / 60000;
    const daysAgo = msAgo / 86400000;

    // HOT — just bought, fading green (0-30 min)
    if (minAgo <= 30) {
        const heat = Math.max(0.15, 1 - (minAgo / 30));
        return { color: "#00ff88", opacity: heat, glow: minAgo < 15 };
    }
    // WARM — recently active (30 min - 7 days), green
    if (daysAgo < 7) return { color: "#4ade80", opacity: 0.6, glow: false };
    // COOLING — 7-14 days, yellow
    if (daysAgo < 14) return { color: "#facc15", opacity: 0.8, glow: false };
    // COLD — 14-30 days, red
    if (daysAgo < 30) return { color: "#ef4444", opacity: 0.8, glow: false };
    // ICE COLD — 30+ days, blue
    return { color: "#60a5fa", opacity: 0.7, glow: false };
}

export function FanRow({ chat, isActive, onClick, showCreatorBadge }: Props) {
    const isUnread = !chat.lastMessage.isRead;
    const avatarUrl = chat.withUser.avatar
        ? `/api/proxy-media?url=${encodeURIComponent(chat.withUser.avatar)}`
        : null;
    const spend = chat.totalSpend ?? 0;
    const tierColor = spendColor(spend);
    // Creator first name for the badge
    const creatorFirstName = chat._creatorName?.split(" ")[0] || "";
    // Temperature ring — based on last purchase recency
    const temp = fanTemperature(chat._lastPurchaseAt);
    const ringStyle = temp ? {
        boxShadow: temp.glow
            ? `0 0 ${temp.opacity * 8}px ${hexToRgba(temp.color, temp.opacity * 0.6)}, 0 0 0 ${0.5 + temp.opacity * 1.5}px ${hexToRgba(temp.color, temp.opacity)}`
            : `0 0 0 2px ${hexToRgba(temp.color, temp.opacity)}`,
        border: `1px solid ${hexToRgba(temp.color, temp.opacity)}`,
    } : undefined;

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
                <div
                    className="w-12 h-12 rounded-full overflow-hidden bg-white/[0.08] flex items-center justify-center"
                    style={ringStyle}
                >
                    {avatarUrl ? (
                        <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-lg font-semibold text-white/30">
                            {chat.withUser.name?.charAt(0)?.toUpperCase() || "?"}
                        </span>
                    )}
                </div>
            </div>

            {/* Name + spend dot + spend amount + preview + time */}
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <h3 className={`text-[15px] truncate ${isUnread ? "font-semibold text-white" : "font-medium text-white/80"}`}>
                            {chat.withUser.name || `@${chat.withUser.username}`}
                        </h3>
                        {/* Spend tier dot next to name */}
                        {tierColor && (
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tierColor }} />
                        )}
                    </div>
                    <span className={`text-[11px] flex-shrink-0 ml-2 ${isUnread ? "text-[#2d786e]" : "text-white/30"}`}>
                        {chat.lastMessage.createdAt ? timeAgo(chat.lastMessage.createdAt) : ""}
                    </span>
                </div>
                <div className="flex items-center mt-0.5">
                    {spend > 0 && tierColor && (
                        <span className="text-[11px] font-semibold mr-1.5 flex-shrink-0" style={{ color: tierColor }}>
                            ${spend.toLocaleString()}
                        </span>
                    )}
                    <p className={`text-[13px] truncate ${isUnread ? "text-white/60" : "text-white/35"}`}>
                        {chat.lastMessage.text}
                    </p>
                </div>
            </div>

            {/* Right side: creator avatar (large, visible) OR unread dot */}
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                {/* Unanswered dot — teal, only when message is unread */}
                {isUnread && (
                    <div className="w-2.5 h-2.5 rounded-full bg-[#2d786e] flex-shrink-0" />
                )}
                {/* Creator avatar — right side, clearly shows which model this fan belongs to */}
                {showCreatorBadge && (chat._creatorAvatar || creatorFirstName) && (
                    <div className="w-9 h-9 rounded-full overflow-hidden border border-white/[0.08] bg-white/[0.08] flex items-center justify-center flex-shrink-0">
                        {chat._creatorAvatar ? (
                            <img src={`/api/proxy-media?url=${encodeURIComponent(chat._creatorAvatar)}`} alt={creatorFirstName} className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-[11px] font-semibold text-white/50">{creatorFirstName.charAt(0)}</span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
