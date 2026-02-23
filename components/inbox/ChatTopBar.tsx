"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronLeft, Eye, EyeOff, Phone, Video, CalendarSearch } from "lucide-react";
import type { Chat } from "./types";

type Props = {
    chat: Chat;
    isSfw: boolean;
    onToggleSfw: () => void;
    onBack?: () => void;
    onJumpToDate?: (date: Date) => void;
    jumpingToDate?: boolean;
};

export function ChatTopBar({ chat, isSfw, onToggleSfw, onBack, onJumpToDate, jumpingToDate }: Props) {
    const avatarUrl = chat.withUser.avatar
        ? `/api/proxy-media?url=${encodeURIComponent(chat.withUser.avatar)}`
        : null;
    const [showDatePicker, setShowDatePicker] = useState(false);
    const datePickerRef = useRef<HTMLDivElement>(null);

    // Close date picker when clicking outside
    useEffect(() => {
        if (!showDatePicker) return;
        const handler = (e: MouseEvent) => {
            if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
                setShowDatePicker(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [showDatePicker]);

    const handleDateSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (!val || !onJumpToDate) return;
        const targetDate = new Date(val + "T00:00:00");
        onJumpToDate(targetDate);
        setShowDatePicker(false);
    };

    return (
        <div className="h-14 px-3 md:px-5 border-b border-white/[0.08] flex items-center justify-between shrink-0 backdrop-blur-xl">
            <div className="flex items-center gap-2">
                {/* Back button — visible on mobile */}
                {onBack && (
                    <button onClick={onBack} className="md:hidden p-1.5 -ml-1 text-[#2d786e] hover:bg-white/5 rounded-lg transition-colors">
                        <ChevronLeft size={24} />
                    </button>
                )}

                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-white/10 flex-shrink-0 flex items-center justify-center overflow-hidden border border-white/[0.08]">
                    {avatarUrl ? (
                        <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-sm font-semibold text-white/40">
                            {chat.withUser.name?.charAt(0)?.toUpperCase() || "?"}
                        </span>
                    )}
                </div>

                {/* Name + status */}
                <div className="min-w-0">
                    <h2 className="font-semibold text-sm text-white/95 truncate">{chat.withUser.name}</h2>
                    <p className="text-[11px] text-white/35 truncate">@{chat.withUser.username}</p>
                </div>
            </div>

            <div className="flex items-center gap-1">
                {/* Jump to date */}
                <div className="relative" ref={datePickerRef}>
                    <button
                        onClick={() => setShowDatePicker(!showDatePicker)}
                        disabled={jumpingToDate}
                        className={`p-2 rounded-full transition-colors ${
                            jumpingToDate
                                ? "text-[#2d786e] animate-pulse"
                                : showDatePicker
                                    ? "text-[#2d786e] bg-[#2d786e]/10"
                                    : "text-white/40 hover:text-white/60 hover:bg-white/5"
                        }`}
                        title="Jump to date"
                    >
                        <CalendarSearch size={18} />
                    </button>
                    {showDatePicker && (
                        <div className="absolute right-0 top-full mt-1 z-20 bg-[#2a2a2a] border border-white/10 rounded-lg p-3 shadow-xl">
                            <p className="text-[11px] text-white/50 mb-2">Jump to date</p>
                            <input
                                type="date"
                                max={new Date().toISOString().split("T")[0]}
                                onChange={handleDateSelect}
                                className="bg-[#1a1a1a] border border-white/10 rounded-md px-3 py-1.5 text-sm text-white/80 outline-none focus:border-[#2d786e] [color-scheme:dark]"
                                autoFocus
                            />
                        </div>
                    )}
                </div>
                <button
                    onClick={onToggleSfw}
                    className={`p-2 rounded-full transition-colors ${isSfw ? "text-[#2d786e] bg-[#2d786e]/10" : "text-white/40 hover:text-white/60 hover:bg-white/5"}`}
                    title={isSfw ? "SFW Mode On" : "SFW Mode Off"}
                >
                    {isSfw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
                <button className="p-2 rounded-full text-white/40 hover:text-white/60 hover:bg-white/5 transition-colors">
                    <Phone size={18} />
                </button>
                <button className="p-2 rounded-full text-white/40 hover:text-white/60 hover:bg-white/5 transition-colors">
                    <Video size={18} />
                </button>
            </div>
        </div>
    );
}
