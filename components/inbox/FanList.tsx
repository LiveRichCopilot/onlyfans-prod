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
    onLoadMore?: () => void;
    hasMoreChats?: boolean;
};

export function FanList({
    creators, selectedCreatorId, onSelectCreator,
    chats, activeChat, onSelectChat, loading,
    sortBy, onSortChange, unreadFirst, onUnreadFirstChange, onApplyFilters,
    onLoadMore, hasMoreChats,
}: Props) {
    return (
        <div className="flex flex-col h-full">
            <CreatorPicker creators={creators} selectedCreatorId={selectedCreatorId} onSelect={onSelectCreator} />
            <SearchBar sortBy={sortBy} onSortChange={onSortChange} unreadFirst={unreadFirst} onUnreadFirstChange={onUnreadFirstChange} onApplyFilters={onApplyFilters} />
            <FilterTabs />
            <NameScroller chats={chats} activeChat={activeChat} onSelectChat={onSelectChat} selectedCreatorId={selectedCreatorId} loading={loading} onLoadMore={onLoadMore} hasMore={hasMoreChats} />
        </div>
    );
}
