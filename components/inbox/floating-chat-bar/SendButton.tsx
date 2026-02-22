"use client";

import { Send } from "lucide-react";

type Props = {
    onClick: () => void;
    disabled: boolean;
    hasText: boolean;
};

export function SendButton({ onClick, disabled, hasText }: Props) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`p-2.5 rounded-xl transition-all shadow-sm ${hasText
                ? "bg-teal-500 text-white hover:bg-teal-400 active:scale-95"
                : "bg-white/5 text-white/30"
            }`}
        >
            <Send size={18} />
        </button>
    );
}
