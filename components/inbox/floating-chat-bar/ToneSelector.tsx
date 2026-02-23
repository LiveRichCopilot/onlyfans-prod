"use client";

import { useState } from "react";

type Tone = "the_tease" | "the_commander" | "the_girlfriend" | "the_brat" | "the_sweet";

const TONES: { id: Tone; label: string; emoji: string }[] = [
    { id: "the_tease", label: "Tease", emoji: "😏" },
    { id: "the_commander", label: "Commander", emoji: "👸" },
    { id: "the_girlfriend", label: "GF", emoji: "💕" },
    { id: "the_brat", label: "Brat", emoji: "😈" },
    { id: "the_sweet", label: "Sweet", emoji: "🥰" },
];

type Props = {
    inputText: string;
    onRewrite: (text: string) => void;
};

export function ToneSelector({ inputText, onRewrite }: Props) {
    const [loading, setLoading] = useState(false);
    const [activeTone, setActiveTone] = useState<Tone | null>(null);

    const handleTone = async (tone: Tone) => {
        if (!inputText.trim() || loading) return;
        setLoading(true);
        setActiveTone(tone);

        try {
            const res = await fetch("/api/inbox/ghost-write", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: inputText, tone }),
            });
            const data = await res.json();
            if (data.rewritten) {
                onRewrite(data.rewritten);
            }
        } catch (e) {
            console.error("Ghost-write failed:", e);
        } finally {
            setLoading(false);
            setActiveTone(null);
        }
    };

    return (
        <div className="flex items-center gap-1 px-2 py-1.5 overflow-x-auto">
            <span className="text-[10px] text-white/30 font-medium flex-shrink-0 mr-1">Rewrite as:</span>
            {TONES.map((tone) => (
                <button
                    key={tone.id}
                    onClick={() => handleTone(tone.id)}
                    disabled={loading || !inputText.trim()}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all flex-shrink-0 ${
                        activeTone === tone.id
                            ? "bg-amber-500/20 text-amber-400 animate-pulse"
                            : "bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white/80"
                    } disabled:opacity-30`}
                >
                    <span>{tone.emoji}</span>
                    <span>{tone.label}</span>
                </button>
            ))}
        </div>
    );
}
