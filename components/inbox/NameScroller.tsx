"use client";

import { useRef, useCallback } from "react";
import { FanRow } from "./FanRow";
import type { Chat } from "./types";

type Props = {
    chats: Chat[];
    activeChat: Chat | null;
    onSelectChat: (chat: Chat) => void;
    selectedCreatorId: string;
    loading: boolean;
    onLoadMore?: () => void;
    hasMore?: boolean;
    tempTick?: number;
};

export function NameScroller({ chats, activeChat, onSelectChat, selectedCreatorId, loading, onLoadMore, hasMore, tempTick }: Props) {
    const scrollRef = useRef<HTMLDivElement>(null);

    const handleScroll = useCallback(() => {
        if (!onLoadMore || !hasMore) return;
        const el = scrollRef.current;
        if (!el) return;
        // Load more when within 200px of bottom
        if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
            onLoadMore();
        }
    }, [onLoadMore, hasMore]);

    if (!selectedCreatorId) {
        return <div className="p-6 text-center text-sm text-white/40">Please select a creator to view chats.</div>;
    }

    if (loading && chats.length === 0) {
        return (
            <div className="p-6 text-center text-sm text-white/50 flex flex-col items-center">
                <div className="animate-spin w-6 h-6 rounded-full border-t-2 border-[#2d786e] mb-3" />
                Loading chats...
            </div>
        );
    }

    if (chats.length === 0) {
        return <div className="p-6 text-center text-sm text-white/40">No chats found.</div>;
    }

    return (
        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
            {chats.map((chat) => (
                <FanRow key={chat.id} chat={chat} isActive={activeChat?.id === chat.id} onClick={() => onSelectChat(chat)} showCreatorBadge={selectedCreatorId === "all"} _tick={tempTick} />
            ))}
            {loading && (
                <div className="py-4 text-center">
                    <div className="animate-spin w-5 h-5 rounded-full border-2 border-white/10 border-t-teal-500 mx-auto" />
                </div>
            )}
            {!hasMore && chats.length > 0 && (
                <div className="py-3 text-center text-[10px] text-white/20">{chats.length} conversations</div>
            )}
        </div>
    );
}
