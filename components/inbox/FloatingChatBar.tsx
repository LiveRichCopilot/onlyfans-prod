"use client";

import { useState } from "react";
import { Plus, Camera, ArrowUp } from "lucide-react";

type Props = {
    inputText: string;
    onTyping: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSend: () => void;
    onSetText: (text: string) => void;
    disabled: boolean;
};

export function FloatingChatBar({ inputText, onTyping, onSend, onSetText, disabled }: Props) {
    const [showTools, setShowTools] = useState(false);
    const hasText = inputText.trim().length > 0;

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey && hasText) {
            e.preventDefault();
            onSend();
        }
    };

    return (
        <div className="px-2 py-2 md:px-4 md:py-3 border-t border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
            <div className="flex items-end gap-1.5">
                {/* + button (tools toggle) */}
                <button
                    onClick={() => setShowTools(!showTools)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                        showTools ? "bg-[#007AFF] text-white rotate-45" : "bg-white/[0.08] text-white/50 hover:bg-white/[0.12]"
                    }`}
                >
                    <Plus size={20} strokeWidth={2.5} />
                </button>

                {/* Camera */}
                <button className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-white/[0.08] text-white/50 hover:bg-white/[0.12] transition-colors">
                    <Camera size={18} />
                </button>

                {/* Text input — iMessage capsule */}
                <div className="flex-1 flex items-end bg-white/[0.06] border border-white/[0.1] rounded-[22px] px-3.5 py-2 min-h-[36px] transition-colors focus-within:border-white/[0.15]">
                    <input
                        type="text"
                        value={inputText}
                        onChange={onTyping}
                        onKeyDown={handleKeyDown}
                        placeholder="Message"
                        disabled={disabled}
                        className="flex-1 bg-transparent text-[15px] text-white/90 placeholder-white/25 outline-none min-w-0"
                    />
                </div>

                {/* Send button — blue circle with arrow (iMessage) */}
                <button
                    onClick={onSend}
                    disabled={!hasText || disabled}
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                        hasText
                            ? "bg-[#007AFF] text-white shadow-lg shadow-blue-500/25 scale-100"
                            : "bg-white/[0.06] text-white/20 scale-95"
                    }`}
                >
                    <ArrowUp size={18} strokeWidth={2.5} />
                </button>
            </div>

            {/* Expandable tools row */}
            {showTools && (
                <div className="flex gap-2 mt-2 px-1 overflow-x-auto pb-1">
                    {[
                        { label: "Vault", icon: "🗃" },
                        { label: "Script", icon: "📝" },
                        { label: "PPV", icon: "💰" },
                        { label: "Voice", icon: "🎤" },
                    ].map((tool) => (
                        <button
                            key={tool.label}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-xs text-white/60 hover:bg-white/[0.1] transition-colors whitespace-nowrap"
                        >
                            <span>{tool.icon}</span>
                            <span>{tool.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
