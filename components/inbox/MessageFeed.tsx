"use client";

import { forwardRef } from "react";
import { MessageBubble } from "./MessageBubble";
import { DateSeparator } from "./DateSeparator";
import { MessageLoader } from "./MessageLoader";
import type { Message } from "./types";

type Props = {
    messages: Message[];
    loading: boolean;
    isSfw: boolean;
    onDisableSfw: () => void;
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
    { messages, loading, isSfw, onDisableSfw },
    ref
) {
    let lastDate = "";

    return (
        <div className="flex-1 overflow-y-auto min-h-0 px-3 py-4 md:px-6 flex flex-col gap-1.5 relative custom-scrollbar">
            {loading && <MessageLoader />}

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

                    const prevMsg = i > 0 ? messages[i - 1] : null;
                    const sameSender = prevMsg?.isFromCreator === msg.isFromCreator;
                    const gapClass = sameSender && !showDate ? "mt-0.5" : "mt-3";

                    return (
                        <div key={msg.id}>
                            {showDate && <DateSeparator label={dateLabel} />}
                            <div className={gapClass}>
                                <MessageBubble message={msg} isSfw={isSfw} onDisableSfw={onDisableSfw} showTail={!sameSender || showDate} />
                            </div>
                        </div>
                    );
                })}
            <div ref={ref} />
        </div>
    );
});
