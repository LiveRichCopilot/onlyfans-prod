"use client";

import { forwardRef } from "react";
import { MessageBubble } from "./MessageBubble";
import type { Message } from "./types";

type Props = {
    messages: Message[];
    loading: boolean;
    isSfw: boolean;
    onDisableSfw: () => void;
};

/** Group messages and insert date separators like iMessage */
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
    { messages, loading, isSfw, onDisableSfw },
    ref
) {
    // Group messages by date for separators
    let lastDate = "";

    return (
        <div className="flex-1 overflow-y-auto min-h-0 px-3 py-4 md:px-6 flex flex-col gap-1.5 relative custom-scrollbar">
            {loading && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
                    <div className="animate-spin w-7 h-7 rounded-full border-2 border-white/20 border-t-[#007AFF] mb-3" />
                    <span className="text-sm text-white/50">Loading messages...</span>
                </div>
            )}

            {!loading && messages.length === 0 && (
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-sm text-white/30">No messages yet</p>
                </div>
            )}

            {!loading &&
                messages.map((msg, i) => {
                    const dateLabel = getDateLabel(msg.createdAt);
                    const showDate = dateLabel !== lastDate;
                    if (showDate) lastDate = dateLabel;

                    // Consecutive messages from same sender get tighter spacing
                    const prevMsg = i > 0 ? messages[i - 1] : null;
                    const sameSender = prevMsg?.isFromCreator === msg.isFromCreator;
                    const gapClass = sameSender && !showDate ? "mt-0.5" : "mt-3";

                    return (
                        <div key={msg.id}>
                            {showDate && (
                                <div className="flex justify-center my-4">
                                    <span className="text-[11px] text-white/35 font-medium bg-white/[0.04] backdrop-blur-md px-3 py-1 rounded-full border border-white/[0.06]">
                                        {dateLabel}
                                    </span>
                                </div>
                            )}
                            <div className={gapClass}>
                                <MessageBubble
                                    message={msg}
                                    isSfw={isSfw}
                                    onDisableSfw={onDisableSfw}
                                    showTail={!sameSender || showDate}
                                />
                            </div>
                        </div>
                    );
                })}
            <div ref={ref} />
        </div>
    );
});
