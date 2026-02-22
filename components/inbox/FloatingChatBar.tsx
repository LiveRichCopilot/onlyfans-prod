"use client";

import { useState } from "react";
import { ToolsToggle } from "./floating-chat-bar/ToolsToggle";
import { CameraButton } from "./floating-chat-bar/CameraButton";
import { MessageInput } from "./floating-chat-bar/MessageInput";
import { SendButton } from "./floating-chat-bar/SendButton";
import { ToolsMenu } from "./floating-chat-bar/ToolsMenu";

type Props = {
    inputText: string;
    onTyping: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSend: () => void;
    onSetText: (text: string) => void;
    disabled: boolean;
};

export function FloatingChatBar({ inputText, onTyping, onSend, onSetText, disabled }: Props) {
    const [showTools, setShowTools] = useState(false);

    return (
        <div className="px-2 py-2 md:px-4 md:py-3 border-t border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
            <div className="flex items-end gap-1.5">
                <ToolsToggle isOpen={showTools} onToggle={() => setShowTools(!showTools)} />
                <CameraButton />
                <MessageInput value={inputText} onChange={onTyping} onSend={onSend} disabled={disabled} />
                <SendButton onClick={onSend} disabled={disabled} hasText={!!inputText.trim()} />
            </div>
            {showTools && <ToolsMenu />}
        </div>
    );
}
