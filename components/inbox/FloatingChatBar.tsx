"use client";

import { useState } from "react";
import { PhotoUploader } from "./floating-chat-bar/PhotoUploader";
import { VaultAttach } from "./floating-chat-bar/VaultAttach";
import { ScriptPicker } from "./floating-chat-bar/ScriptPicker";
import { PriceTag } from "./floating-chat-bar/PriceTag";
import { MessageInput } from "./floating-chat-bar/MessageInput";
import { SendButton } from "./floating-chat-bar/SendButton";

type Props = {
    inputText: string;
    onTyping: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSend: () => void;
    onSetText: (text: string) => void;
    disabled: boolean;
};

export function FloatingChatBar({ inputText, onTyping, onSend, onSetText, disabled }: Props) {
    const [price, setPrice] = useState("");

    return (
        <div className="p-4 border-t border-white/10 bg-black/20 backdrop-blur-md">
            <div className="flex items-center bg-white/5 border border-white/10 rounded-2xl px-2 py-1.5 shadow-inner gap-1">
                <PhotoUploader />
                <VaultAttach />
                <ScriptPicker onInsertScript={onSetText} />
                <PriceTag price={price} onPriceChange={setPrice} />
                <MessageInput value={inputText} onChange={onTyping} onSend={onSend} disabled={disabled} />
                <SendButton onClick={onSend} disabled={!inputText.trim() || disabled} hasText={!!inputText.trim()} />
            </div>
        </div>
    );
}
