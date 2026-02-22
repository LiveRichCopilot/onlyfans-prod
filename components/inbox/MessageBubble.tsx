"use client";

import { CheckCheck } from "lucide-react";
import { MediaPreview } from "./MediaPreview";
import type { Message } from "./types";

type Props = {
    message: Message;
    isSfw: boolean;
    onDisableSfw: () => void;
};

export function MessageBubble({ message: msg, isSfw, onDisableSfw }: Props) {
    const isSelf = msg.isFromCreator;

    return (
        <div className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-md ${isSelf
                ? 'bg-teal-600/80 backdrop-blur-md text-white rounded-br-sm border border-teal-500/30'
                : 'bg-white/10 backdrop-blur-md text-white/95 rounded-bl-sm border border-white/10'
                }`}>
                {msg.media && msg.media.length > 0 && (
                    <div className={`grid gap-1.5 mb-2 ${msg.media.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        {msg.media.map(med => (
                            <MediaPreview key={med.id} media={med} isSfw={isSfw} onDisableSfw={onDisableSfw} />
                        ))}
                    </div>
                )}
                {msg.text && (
                    <div
                        dangerouslySetInnerHTML={{ __html: msg.text }}
                        className="break-words whitespace-pre-wrap [&>p]:m-0 [&>p]:inline"
                    />
                )}
                {isSelf && (
                    <div className="flex justify-between items-center mt-1">
                        <span className="text-[10px] text-white/50 bg-black/20 px-2 py-0.5 rounded-full border border-white/5">
                            Sent by {msg.senderName}
                        </span>
                        <CheckCheck size={12} className="text-[#0d9488]" />
                    </div>
                )}
            </div>
        </div>
    );
}
