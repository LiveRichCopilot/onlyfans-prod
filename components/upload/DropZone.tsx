"use client";

import { useCallback, useRef, useState } from "react";

type Props = {
    onFiles: (files: FileList | File[]) => void;
    disabled?: boolean;
};

export function DropZone({ onFiles, disabled }: Props) {
    const [dragOver, setDragOver] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }, []);
    const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }, []);
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation(); setDragOver(false);
        if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
    }, [onFiles]);

    return (
        <div
            onClick={() => !disabled && inputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative overflow-hidden rounded-3xl p-8 text-center transition-all duration-300 border ${
                disabled ? "opacity-50" : "cursor-pointer active:scale-[0.99]"
            } ${dragOver
                ? "border-teal-400/30 bg-teal-500/[0.08] shadow-[0_0_40px_-8px_rgba(13,148,136,0.2)]"
                : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05] hover:border-white/[0.12]"
            } backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.25)]`}
        >
            {/* Glass specular highlight */}
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />
            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none rounded-t-3xl" />

            <input ref={inputRef} type="file" multiple accept="video/*,image/*,audio/*" className="hidden"
                onChange={e => { if (e.target.files?.length) { onFiles(e.target.files); e.target.value = ""; } }}
            />
            <div className={`relative w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                dragOver ? "bg-teal-500/15 scale-110" : "bg-white/[0.04]"
            }`}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                    className={`transition-all duration-300 ${dragOver ? "text-teal-400 -translate-y-0.5" : "text-white/25"}`}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
            </div>
            <p className="relative text-white/60 text-sm font-medium mb-1">
                {dragOver ? "Drop files here" : "Tap to select or drag files"}
            </p>
            <p className="relative text-white/25 text-xs">Videos, images, audio</p>
        </div>
    );
}
