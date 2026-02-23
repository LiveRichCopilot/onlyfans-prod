"use client";

import { useState } from "react";
import { ToolsToggle } from "./floating-chat-bar/ToolsToggle";
import { CameraButton } from "./floating-chat-bar/CameraButton";
import { MessageInput } from "./floating-chat-bar/MessageInput";
import { SendButton } from "./floating-chat-bar/SendButton";
import { ToolsMenu } from "./floating-chat-bar/ToolsMenu";
import { ToneSelector } from "./floating-chat-bar/ToneSelector";

type Props = {
    inputText: string;
    onTyping: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSend: () => void;
    onSetText: (text: string) => void;
    disabled: boolean;
    onAiSuggest?: () => void;
    aiSuggestLoading?: boolean;
};

export function FloatingChatBar({ inputText, onTyping, onSend, onSetText, disabled, onAiSuggest, aiSuggestLoading }: Props) {
    const [showTools, setShowTools] = useState(false);
    const [showTones, setShowTones] = useState(false);

    return (
        <div className="px-2 py-2 md:px-4 md:py-3 border-t border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
            {/* Tone selector row — shown when "Rewrite" is clicked */}
            {showTones && inputText.trim() && (
                <ToneSelector inputText={inputText} onRewrite={(text) => { onSetText(text); setShowTones(false); }} />
            )}
            <div className="flex items-end gap-1.5">
                <ToolsToggle isOpen={showTools} onToggle={() => setShowTools(!showTools)} />
                <CameraButton />
                {/* AI Suggest sparkle button */}
                {onAiSuggest && (
                    <button
                        onClick={onAiSuggest}
                        disabled={aiSuggestLoading || disabled}
                        className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg transition-all ${
                            aiSuggestLoading
                                ? "bg-amber-500/20 text-amber-400 animate-pulse"
                                : "bg-white/[0.04] text-amber-400/60 hover:bg-amber-500/10 hover:text-amber-400"
                        }`}
                        title="AI Suggest"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                        </svg>
                    </button>
                )}
                {/* Rewrite / Tone button — appears when there's text */}
                {inputText.trim() && (
                    <button
                        onClick={() => setShowTones(!showTones)}
                        className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg transition-all ${
                            showTones
                                ? "bg-purple-500/20 text-purple-400"
                                : "bg-white/[0.04] text-white/30 hover:bg-purple-500/10 hover:text-purple-400"
                        }`}
                        title="Rewrite in different tone"
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                    </button>
                )}
                <MessageInput value={inputText} onChange={onTyping} onSend={onSend} disabled={disabled} />
                <SendButton onClick={onSend} disabled={disabled} hasText={!!inputText.trim()} />
            </div>
            {showTools && <ToolsMenu />}
        </div>
    );
}
