"use client";

import { ArrowUp } from "lucide-react";

type Props = {
    onClick: () => void;
    disabled: boolean;
    hasText: boolean;
};

export function SendButton({ onClick, disabled, hasText }: Props) {
    return (
        <button
            onClick={onClick}
            disabled={!hasText || disabled}
            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                hasText
                    ? "bg-[#0D9488] text-white shadow-lg shadow-teal-500/25 scale-100"
                    : "bg-white/[0.06] text-white/20 scale-95"
            }`}
        >
            <ArrowUp size={18} strokeWidth={2.5} />
        </button>
    );
}
