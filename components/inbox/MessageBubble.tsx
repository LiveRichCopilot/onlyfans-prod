"use client";

import { Check, CheckCheck } from "lucide-react";
import { MediaPreview } from "./MediaPreview";
import type { Message } from "./types";

type Props = {
    message: Message;
    isSfw: boolean;
    onDisableSfw: () => void;
    showTail?: boolean;
};

export function MessageBubble({ message: msg, isSfw, onDisableSfw, showTail = true }: Props) {
    const isSelf = msg.isFromCreator;
    const time = msg.createdAt
        ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "";

    return (
        <div className={`flex ${isSelf ? "justify-end" : "justify-start"} group`}>
            <div className={`relative max-w-[80%] sm:max-w-[70%] ${isSelf ? "mr-1" : "ml-1"}`}>
                {/* iMessage bubble */}
                <div
                    className={`rounded-[20px] px-3.5 py-2 text-[15px] leading-relaxed shadow-sm ${
                        isSelf
                            ? "bg-[#007AFF] text-white rounded-br-[6px]"
                            : "bg-white/[0.08] backdrop-blur-md text-white/95 rounded-bl-[6px] border border-white/[0.06]"
                    }`}
                >
                    {/* Media attachments */}
                    {msg.media && msg.media.length > 0 && (
                        <div className={`${msg.text ? "mb-1.5" : ""} -mx-1.5 -mt-0.5 ${msg.text ? "" : "-mb-0.5"} ${msg.media.length > 1 ? "grid grid-cols-2 gap-1" : ""}`}>
                            {msg.media.map((med) => (
                                <div key={med.id} className="rounded-2xl overflow-hidden">
                                    <MediaPreview media={med} isSfw={isSfw} onDisableSfw={onDisableSfw} />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Message text */}
                    {msg.text && (
                        <div
                            dangerouslySetInnerHTML={{ __html: msg.text }}
                            className="break-words whitespace-pre-wrap [&>p]:m-0 [&>p]:inline"
                        />
                    )}
                </div>

                {/* Timestamp + delivery status (iMessage style) */}
                <div className={`flex items-center gap-1 mt-0.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity ${isSelf ? "justify-end" : "justify-start"}`}>
                    <span className="text-[10px] text-white/30">{time}</span>
                    {isSelf && (
                        <CheckCheck size={11} className="text-white/30" />
                    )}
                </div>
            </div>
        </div>
    );
}
