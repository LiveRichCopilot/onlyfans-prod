"use client";

import { FanRow } from "./FanRow";
import type { Chat } from "./types";

type Props = {
    chats: Chat[];
    activeChat: Chat | null;
    onSelectChat: (chat: Chat) => void;
    selectedCreatorId: string;
    loading: boolean;
};

export function NameScroller({ chats, activeChat, onSelectChat, selectedCreatorId, loading }: Props) {
    if (!selectedCreatorId) {
        return <div className="p-6 text-center text-sm text-white/40">Please select a creator to view chats.</div>;
    }

    if (loading) {
        return (
            <div className="p-6 text-center text-sm text-white/50 flex flex-col items-center">
                <div className="animate-spin w-6 h-6 rounded-full border-t-2 border-teal-500 mb-3"></div>
                Loading Live Live Chats...
            </div>
        );
    }

    if (chats.length === 0) {
        return <div className="p-6 text-center text-sm text-white/40">No chats found for this creator.</div>;
    }

    return (
        <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
            {chats.map(chat => (
                <FanRow key={chat.id} chat={chat} isActive={activeChat?.id === chat.id} onClick={() => onSelectChat(chat)} />
            ))}
        </div>
    );
}
