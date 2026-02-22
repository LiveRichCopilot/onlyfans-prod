"use client";

import { Search } from "lucide-react";
import { SortMenu } from "./SortMenu";
import { FilterPanel } from "./FilterPanel";

type Props = {
    sortBy: string;
    onSortChange: (value: string) => void;
    unreadFirst: boolean;
    onUnreadFirstChange: (value: boolean) => void;
    onApplyFilters: (filters: any) => void;
};

export function SearchBar({ sortBy, onSortChange, unreadFirst, onUnreadFirstChange, onApplyFilters }: Props) {
    return (
        <div className="p-4 border-b border-white/10 flex items-center gap-2 bg-black/20">
            <div className="flex bg-white/5 rounded-xl border border-white/10 p-1 relative flex-1">
                <Search className="absolute left-3 top-2.5 text-white/40" size={16} />
                <input
                    type="text"
                    placeholder="Search chats"
                    className="bg-transparent border-none outline-none w-full pl-8 pr-4 text-sm py-1.5 text-white placeholder-white/30"
                />
            </div>
            <FilterPanel onApply={onApplyFilters} />
            <SortMenu sortBy={sortBy} onSortChange={onSortChange} unreadFirst={unreadFirst} onUnreadFirstChange={onUnreadFirstChange} />
        </div>
    );
}
