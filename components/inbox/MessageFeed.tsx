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

export const MessageFeed = forwardRef<HTMLDivElement, Props>(function MessageFeed({ messages, loading, isSfw, onDisableSfw }, ref) {
    return (
        <div className="flex-1 overflow-y-auto min-h-0 p-6 flex flex-col gap-4 relative custom-scrollbar bg-black/10">
            <div className="text-center text-[10px] text-white/30 uppercase tracking-widest my-4 bg-black/20 py-1.5 px-4 rounded-full mx-auto border border-white/5 shadow-inner">Live API Chat Thread Synced Securely</div>

            {loading && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-white/60">
                    <div className="animate-spin w-8 h-8 rounded-full border-t-2 border-teal-500 mb-3"></div>
                    Syncing OnlyFans payload...
                </div>
            )}

            {!loading && messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} isSfw={isSfw} onDisableSfw={onDisableSfw} />
            ))}
            <div ref={ref} />
        </div>
    );
});
