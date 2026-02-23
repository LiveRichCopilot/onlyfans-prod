"use client";

import { forwardRef, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { MessageBubble } from "./MessageBubble";
import { DateSeparator } from "./DateSeparator";
import { MessageLoader } from "./MessageLoader";
import type { Message } from "./types";

type Props = {
    messages: Message[];
    loading: boolean;
    isSfw: boolean;
    onDisableSfw: () => void;
    loadingOlder?: boolean;
    hasMore?: boolean;
    onLoadOlder?: () => void;
    creatorId?: string;
    jumpingToDate?: boolean;
    jumpProgress?: number;
    isJumped?: boolean;
    onReturnToLatest?: () => void;
};

function getDateLabel(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    if (msgDate.getTime() === today.getTime()) return "Today";
    if (msgDate.getTime() === yesterday.getTime()) return "Yesterday";
    return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

export const MessageFeed = forwardRef<HTMLDivElement, Props>(function MessageFeed(
    { messages, loading, isSfw, onDisableSfw, loadingOlder, hasMore, onLoadOlder, creatorId, jumpingToDate, jumpProgress, isJumped, onReturnToLatest },
    ref
) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const sentinelRef = useRef<HTMLDivElement>(null);
    // Scroll preservation: record scrollHeight/scrollTop before prepend, restore after
    const pendingPrependAdjustRef = useRef<null | { prevHeight: number; prevTop: number }>(null);
    const prevFirstMsgIdRef = useRef<string | null>(null);
    let lastDate = "";

    // Wrapper: capture scroll position before triggering onLoadOlder
    const handleLoadOlder = useCallback(() => {
        const el = scrollContainerRef.current;
        if (!el || !onLoadOlder) return;
        pendingPrependAdjustRef.current = {
            prevHeight: el.scrollHeight,
            prevTop: el.scrollTop,
        };
        onLoadOlder();
    }, [onLoadOlder]);

    // After messages change, restore scroll position so the same message stays anchored
    // Only adjusts on actual prepend (handleLoadOlder sets the ref). Chat switch / jump-to-date
    // are detected by the first message ID changing, which clears the pending adjustment.
    useLayoutEffect(() => {
        const el = scrollContainerRef.current;
        const pending = pendingPrependAdjustRef.current;
        const currentFirstId = messages[0]?.id ?? null;
        const prevFirstId = prevFirstMsgIdRef.current;

        // If the first message changed, this was a full list replacement (not a prepend)
        // Clear any stale pending adjustment
        if (pending && prevFirstId !== null && currentFirstId !== prevFirstId) {
            // First message is different = list was replaced, not prepended
            // But if messages grew AND the previous first is still in the list, it was a prepend
            const isPrepend = messages.some(m => m.id === prevFirstId);
            if (!isPrepend) {
                pendingPrependAdjustRef.current = null;
                prevFirstMsgIdRef.current = currentFirstId;
                return;
            }
        }

        prevFirstMsgIdRef.current = currentFirstId;

        if (!el || !pending) return;
        const newHeight = el.scrollHeight;
        el.scrollTop = pending.prevTop + (newHeight - pending.prevHeight);
        pendingPrependAdjustRef.current = null;
    }, [messages]);

    // IntersectionObserver: detect when user scrolls near top to load older messages
    useEffect(() => {
        if (!onLoadOlder || !hasMore || loading) return;
        const sentinel = sentinelRef.current;
        const container = scrollContainerRef.current;
        if (!sentinel || !container) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !loadingOlder && hasMore) {
                    handleLoadOlder();
                }
            },
            { root: container, rootMargin: "200px 0px 0px 0px", threshold: 0 }
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [handleLoadOlder, hasMore, loading, loadingOlder]);

    return (
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto min-h-0 px-3 py-4 md:px-6 flex flex-col gap-1.5 relative custom-scrollbar">
            {/* Sentinel + loading spinner at top for infinite scroll up */}
            {hasMore && !loading && (
                <div ref={sentinelRef} className="flex justify-center py-2 shrink-0">
                    {loadingOlder && (
                        <div className="flex items-center gap-2 text-xs text-white/40">
                            <div className="animate-spin w-4 h-4 rounded-full border-2 border-white/10 border-t-[#2d786e]" />
                            Loading older messages...
                        </div>
                    )}
                </div>
            )}

            {/* Jump to date loading overlay with progress */}
            {jumpingToDate && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-10 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2">
                        <div className="animate-spin w-6 h-6 rounded-full border-2 border-white/10 border-t-[#2d786e]" />
                        <span className="text-sm text-white/60">Jumping to date...</span>
                        {(jumpProgress ?? 0) > 0 && (
                            <span className="text-[11px] text-white/35">Scanned {jumpProgress?.toLocaleString()} messages</span>
                        )}
                    </div>
                </div>
            )}

            {/* "Return to latest" banner when viewing historical messages */}
            {isJumped && !jumpingToDate && onReturnToLatest && (
                <div className="sticky top-0 z-10 flex justify-center py-2">
                    <button
                        onClick={onReturnToLatest}
                        className="px-4 py-1.5 rounded-full bg-[#2d786e]/90 text-white text-xs font-semibold shadow-lg hover:bg-[#2d786e] transition-colors backdrop-blur-sm"
                    >
                        Return to latest messages
                    </button>
                </div>
            )}

            {loading && !jumpingToDate && <MessageLoader />}

            {!loading && !jumpingToDate && messages.length === 0 && (
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-sm text-white/30">No messages yet</p>
                </div>
            )}

            {!loading &&
                messages.map((msg, i) => {
                    const dateLabel = getDateLabel(msg.createdAt);
                    const showDate = dateLabel !== lastDate;
                    if (showDate) lastDate = dateLabel;

                    const prevMsg = i > 0 ? messages[i - 1] : null;
                    const sameSender = prevMsg?.isFromCreator === msg.isFromCreator;
                    const gapClass = sameSender && !showDate ? "mt-0.5" : "mt-3";

                    return (
                        <div key={msg.id}>
                            {showDate && <DateSeparator label={dateLabel} />}
                            <div className={gapClass}>
                                <MessageBubble message={msg} isSfw={isSfw} onDisableSfw={onDisableSfw} showTail={!sameSender || showDate} creatorId={creatorId} />
                            </div>
                        </div>
                    );
                })}
            <div ref={ref} />
        </div>
    );
});
