"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type Props = {
    open: boolean;
    onSelect: (date: Date) => void;
    onClose: () => void;
};

export function CalendarPicker({ open, onSelect, onClose }: Props) {
    const today = new Date();
    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth());
    const modalRef = useRef<HTMLDivElement>(null);

    // Reset to current month when opened
    useEffect(() => {
        if (open) {
            setViewYear(today.getFullYear());
            setViewMonth(today.getMonth());
        }
    }, [open]);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open, onClose]);

    // Close on Escape
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [open, onClose]);

    const calendarDays = useMemo(() => {
        const firstDay = new Date(viewYear, viewMonth, 1).getDay();
        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

        const days: { day: number; inMonth: boolean; date: Date }[] = [];

        for (let i = firstDay - 1; i >= 0; i--) {
            const d = daysInPrevMonth - i;
            days.push({ day: d, inMonth: false, date: new Date(viewYear, viewMonth - 1, d) });
        }
        for (let d = 1; d <= daysInMonth; d++) {
            days.push({ day: d, inMonth: true, date: new Date(viewYear, viewMonth, d) });
        }
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
        const now = new Date();
        if (viewYear === now.getFullYear() && viewMonth >= now.getMonth()) return;
        if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
        else setViewMonth(viewMonth + 1);
    };

    const isToday = (date: Date) =>
        date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();

    const isFuture = (date: Date) => date > today;
    const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();

    if (!open) return null;

    // Render via portal at document.body to escape all stacking contexts
    return createPortal(
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/40 backdrop-blur-[2px]"
                style={{ zIndex: 9998 }}
                onClick={onClose}
            />
            {/* Calendar modal */}
            <div
                ref={modalRef}
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#1a1a1e] border border-white/10 rounded-2xl p-5 shadow-2xl"
                style={{ zIndex: 9999, width: 300 }}
            >
                {/* Month/Year header */}
                <div className="flex items-center justify-between mb-4">
                    <button onClick={goToPrevMonth} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white/80 transition-colors">
                        <ChevronLeft size={16} />
                    </button>
                    <span className="text-sm font-semibold text-white/90">{MONTHS[viewMonth]} {viewYear}</span>
                    <button
                        onClick={goToNextMonth}
                        disabled={isCurrentMonth}
                        className={`p-1.5 rounded-lg transition-colors ${isCurrentMonth ? "text-white/15 cursor-not-allowed" : "hover:bg-white/10 text-white/50 hover:text-white/80"}`}
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
                <div className="grid grid-cols-7 gap-0.5">
                    {calendarDays.map((cell, i) => {
                        const future = isFuture(cell.date);
                        const todayCell = isToday(cell.date);
                        return (
                            <button
                                key={i}
                                disabled={future}
                                onClick={() => { if (!future) { onSelect(cell.date); onClose(); } }}
                                className={`h-9 w-full rounded-lg text-[12px] font-medium transition-colors ${
                                    future
                                        ? "text-white/10 cursor-not-allowed"
                                        : todayCell
                                            ? "bg-[#2d786e] text-white font-bold"
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
                <div className="flex gap-2 mt-4 pt-3 border-t border-white/[0.06]">
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
                            className="flex-1 text-[10px] font-medium py-2 rounded-lg bg-white/[0.05] text-white/50 hover:bg-white/[0.1] hover:text-white/70 transition-colors"
                        >
                            {q.label}
                        </button>
                    ))}
                </div>
            </div>
        </>,
        document.body
    );
}
