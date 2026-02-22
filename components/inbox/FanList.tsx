"use client";

import { CreatorPicker } from "./CreatorPicker";
import { SearchBar } from "./SearchBar";
import { FilterTabs } from "./FilterTabs";
import { NameScroller } from "./NameScroller";
import type { Chat } from "./types";

type Props = {
    creators: any[];
    selectedCreatorId: string;
    onSelectCreator: (id: string) => void;
    chats: Chat[];
    activeChat: Chat | null;
    onSelectChat: (chat: Chat) => void;
    loading: boolean;
    sortBy: string;
    onSortChange: (value: string) => void;
    unreadFirst: boolean;
    onUnreadFirstChange: (value: boolean) => void;
    onApplyFilters: (filters: any) => void;
};

export function FanList({ creators, selectedCreatorId, onSelectCreator, chats, activeChat, onSelectChat, loading, sortBy, onSortChange, unreadFirst, onUnreadFirstChange, onApplyFilters }: Props) {
    return (
        <div className="w-[340px] m-4 mr-0 flex flex-col z-10 glass-panel rounded-3xl overflow-hidden border-white/10">
            <CreatorPicker creators={creators} selectedCreatorId={selectedCreatorId} onSelect={onSelectCreator} />
            <SearchBar sortBy={sortBy} onSortChange={onSortChange} unreadFirst={unreadFirst} onUnreadFirstChange={onUnreadFirstChange} onApplyFilters={onApplyFilters} />
            <FilterTabs />
            <NameScroller chats={chats} activeChat={activeChat} onSelectChat={onSelectChat} selectedCreatorId={selectedCreatorId} loading={loading} />
        </div>
    );
}
