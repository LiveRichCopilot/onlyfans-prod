"use client";

import { FileText } from "lucide-react";
import { useState } from "react";

type Props = {
    onInsertScript: (text: string) => void;
};

export function ScriptPicker({ onInsertScript }: Props) {
    const [open, setOpen] = useState(false);

    // Placeholder scripts — will be loaded from DB/API later
    const scripts = [
        { id: "1", label: "Welcome New Fan", text: "Hey babe! So glad you're here 💕 I have something special just for you..." },
        { id: "2", label: "PPV Offer", text: "I just made this for you... want to see? 😘" },
        { id: "3", label: "Tip Thank You", text: "Omg thank you so much! You're the sweetest 🥰 Let me send you something special..." },
    ];

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(!open)}
                className={`p-2 transition-colors rounded-xl ${open ? "text-purple-400 bg-purple-500/10" : "text-white/40 hover:bg-white/10 hover:text-white"}`}
                title="Quick Scripts"
            >
                <FileText size={20} />
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
                    <div className="absolute bottom-full left-0 mb-2 w-72 z-40 glass-panel rounded-2xl border border-white/10 p-3 shadow-2xl bg-gray-900/95 backdrop-blur-xl">
                        <div className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2 px-2">Quick Scripts</div>
                        <div className="space-y-1">
                            {scripts.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => { onInsertScript(s.text); setOpen(false); }}
                                    className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-white/70 hover:bg-white/5 transition-colors"
                                >
                                    <div className="font-medium text-white/90 text-xs mb-0.5">{s.label}</div>
                                    <div className="text-white/40 text-xs truncate">{s.text}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
