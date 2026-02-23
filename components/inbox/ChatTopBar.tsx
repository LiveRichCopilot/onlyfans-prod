"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Eye, EyeOff, Phone, Video, CalendarSearch } from "lucide-react";
import type { Chat } from "./types";

type Props = {
    chat: Chat;
    isSfw: boolean;
    onToggleSfw: () => void;
    onBack?: () => void;
    onJumpToDate?: (date: Date) => void;
    jumpingToDate?: boolean;
};

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function CalendarPicker({ onSelect, onClose }: { onSelect: (date: Date) => void; onClose: () => void }) {
    const today = new Date();
    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth());

    const calendarDays = useMemo(() => {
        const firstDay = new Date(viewYear, viewMonth, 1).getDay();
        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

        const days: { day: number; inMonth: boolean; date: Date }[] = [];

        // Previous month trailing days
        for (let i = firstDay - 1; i >= 0; i--) {
            const d = daysInPrevMonth - i;
            days.push({ day: d, inMonth: false, date: new Date(viewYear, viewMonth - 1, d) });
        }
        // Current month
        for (let d = 1; d <= daysInMonth; d++) {
            days.push({ day: d, inMonth: true, date: new Date(viewYear, viewMonth, d) });
        }
        // Next month leading days (fill to 42 = 6 rows)
        const remaining = 42 - days.length;
        for (let d = 1; d <= remaining; d++) {
            days.push({ day: d, inMonth: false, date: new Date(viewYear, viewMonth + 1, d) });
        }
        return days;
    }, [viewYear, viewMonth]);

    const goToPrevMonth = () => {
        if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
        else setViewMonth(viewMonth - 1);
    };

    const goToNextMonth = () => {
        // Don't go past current month
        const now = new Date();
        if (viewYear === now.getFullYear() && viewMonth >= now.getMonth()) return;
        if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
        else setViewMonth(viewMonth + 1);
    };

    const isToday = (date: Date) => {
        return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
    };

    const isFuture = (date: Date) => date > today;

    const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();

    return (
        <div className="w-[280px]">
            {/* Month/Year header with nav arrows */}
            <div className="flex items-center justify-between mb-3">
                <button onClick={goToPrevMonth} className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white/80 transition-colors">
                    <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-medium text-white/80">{MONTHS[viewMonth]} {viewYear}</span>
                <button
                    onClick={goToNextMonth}
                    disabled={isCurrentMonth}
                    className={`p-1 rounded transition-colors ${isCurrentMonth ? "text-white/15 cursor-not-allowed" : "hover:bg-white/10 text-white/50 hover:text-white/80"}`}
                >
                    <ChevronRight size={16} />
                </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
                {DAYS.map(d => (
                    <div key={d} className="text-center text-[10px] text-white/30 font-medium py-1">{d}</div>
                ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7">
                {calendarDays.map((cell, i) => {
                    const future = isFuture(cell.date);
                    const todayCell = isToday(cell.date);
                    return (
                        <button
                            key={i}
                            disabled={future}
                            onClick={() => { if (!future) { onSelect(cell.date); onClose(); } }}
                            className={`h-8 w-full rounded-md text-[12px] transition-colors ${
                                future
                                    ? "text-white/10 cursor-not-allowed"
                                    : todayCell
                                        ? "bg-[#2d786e] text-white font-semibold"
                                        : cell.inMonth
                                            ? "text-white/70 hover:bg-white/10 hover:text-white"
                                            : "text-white/20 hover:bg-white/5 hover:text-white/40"
                            }`}
                        >
                            {cell.day}
                        </button>
                    );
                })}
            </div>

            {/* Quick jumps */}
            <div className="flex gap-1.5 mt-3 pt-3 border-t border-white/[0.06]">
                {[
                    { label: "Today", days: 0 },
                    { label: "1w ago", days: 7 },
                    { label: "2w ago", days: 14 },
                    { label: "1m ago", days: 30 },
                ].map(q => (
                    <button
                        key={q.label}
                        onClick={() => {
                            const d = new Date();
                            d.setDate(d.getDate() - q.days);
                            onSelect(d);
                            onClose();
                        }}
                        className="flex-1 text-[10px] py-1.5 rounded-md bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white/70 transition-colors"
                    >
                        {q.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

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

    const handleDateSelect = (date: Date) => {
        if (!onJumpToDate) return;
        onJumpToDate(date);
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
                        <>
                            {/* Backdrop */}
                            <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowDatePicker(false)} />
                            {/* Calendar modal — fixed center, above everything */}
                            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-[#2a2a2a] border border-white/10 rounded-xl p-4 shadow-2xl">
                                <CalendarPicker onSelect={handleDateSelect} onClose={() => setShowDatePicker(false)} />
                            </div>
                        </>
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
