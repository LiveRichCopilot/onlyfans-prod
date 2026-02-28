"use client";

import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, Users } from "lucide-react";

type Creator = {
    id: string;
    name: string | null;
    avatarUrl: string | null;
    active?: boolean;
};

type Props = {
    creators: Creator[];
    selectedIds: string[];
    onChange: (ids: string[]) => void;
};

export function AccountsDropdown({ creators, selectedIds, onChange }: Props) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleCreator = (id: string) => {
        if (selectedIds.includes(id)) {
            onChange(selectedIds.filter((s) => s !== id));
        } else {
            onChange([...selectedIds, id]);
        }
    };

    const toggleAll = () => {
        if (selectedIds.length === creators.length) {
            onChange([]);
        } else {
            onChange(creators.map((c) => c.id));
        }
    };

    const count = selectedIds.length;
    const label =
        count === 0
            ? "Assign Accounts"
            : count === creators.length
              ? "All Accounts"
              : `${count} Account${count !== 1 ? "s" : ""}`;

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(!open)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition ${
                    count === 0
                        ? "border-white/20 text-white/50 bg-white/5"
                        : "border-teal-500/30 text-teal-400 bg-teal-500/5"
                }`}
            >
                <Users size={14} />
                {label}
                <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
            </button>

            {open && (
                <>
                <div className="fixed inset-0 z-40" />
                <div className="absolute top-full left-0 mt-2 w-64 rounded-2xl border border-white/15 bg-gray-950/90 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.05)] z-50 overflow-hidden">
                    <div className="max-h-[280px] overflow-y-auto p-2">
                        <button
                            onClick={toggleAll}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition"
                        >
                            <div
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                                    selectedIds.length === creators.length
                                        ? "bg-teal-500 border-teal-500"
                                        : "border-white/20"
                                }`}
                            >
                                {selectedIds.length === creators.length && (
                                    <Check size={12} className="text-black" />
                                )}
                            </div>
                            <span className="text-sm font-medium text-white/80">Select all</span>
                        </button>

                        {creators.map((c) => {
                            const selected = selectedIds.includes(c.id);
                            return (
                                <button
                                    key={c.id}
                                    onClick={() => toggleCreator(c.id)}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition"
                                >
                                    <div
                                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                                            selected ? "bg-teal-500 border-teal-500" : "border-white/20"
                                        }`}
                                    >
                                        {selected && <Check size={12} className="text-black" />}
                                    </div>
                                    {c.avatarUrl ? (
                                        <img
                                            src={`/api/proxy-media?url=${encodeURIComponent(c.avatarUrl)}`}
                                            alt=""
                                            className="w-7 h-7 rounded-full border border-white/20 object-cover"
                                        />
                                    ) : (
                                        <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs border border-white/20">
                                            {c.name?.charAt(0) || "?"}
                                        </div>
                                    )}
                                    <span className="text-sm text-white/80 truncate">
                                        {c.name || "Unknown"}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
                </>
            )}
        </div>
    );
}
