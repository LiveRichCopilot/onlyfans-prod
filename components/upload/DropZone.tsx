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
            className={`bg-white/[0.04] border border-white/[0.06] backdrop-blur-xl rounded-2xl p-8 text-center transition-all duration-200 ${
                disabled ? "opacity-50" : "cursor-pointer"
            } ${dragOver ? "border-teal-400/40 bg-teal-500/[0.06] scale-[1.01]" : "hover:border-white/10"}`}
        >
            <input ref={inputRef} type="file" multiple accept="video/*,image/*,audio/*" className="hidden"
                onChange={e => { if (e.target.files?.length) { onFiles(e.target.files); e.target.value = ""; } }}
            />
            <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center transition-colors duration-200 ${dragOver ? "bg-teal-500/20" : "bg-white/[0.04]"}`}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                    className={`transition-colors duration-200 ${dragOver ? "text-teal-400" : "text-white/30"}`}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
            </div>
            <p className="text-white/70 text-sm font-medium mb-1">{dragOver ? "Drop files here" : "Tap to select or drag files here"}</p>
            <p className="text-white/30 text-xs">Videos, images, audio - any size</p>
        </div>
    );
}
