"use client";

import { Plus } from "lucide-react";

type Props = {
    isOpen: boolean;
    onToggle: () => void;
};

export function ToolsToggle({ isOpen, onToggle }: Props) {
    return (
        <button
            onClick={onToggle}
            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                isOpen ? "bg-[#0D9488] text-white rotate-45" : "bg-white/[0.08] text-white/50 hover:bg-white/[0.12]"
            }`}
        >
            <Plus size={20} strokeWidth={2.5} />
        </button>
    );
}
