"use client";

import { useCallback, useRef, useState } from "react";

type Props = {
    onResize: (deltaX: number) => void;
    side?: "left" | "right"; // which direction does dragging expand
};

export function PanelSlider({ onResize, side = "right" }: Props) {
    const [isDragging, setIsDragging] = useState(false);
    const startX = useRef(0);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        startX.current = e.clientX;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const delta = moveEvent.clientX - startX.current;
            startX.current = moveEvent.clientX;
            onResize(side === "right" ? delta : -delta);
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
    }, [onResize, side]);

    return (
        <div
            onMouseDown={handleMouseDown}
            className={`w-2 flex-shrink-0 cursor-col-resize group relative z-20 flex items-center justify-center
                ${isDragging ? "bg-teal-500/20" : "hover:bg-white/5"} transition-colors`}
        >
            {/* The glowing line */}
            <div className={`w-[2px] h-full rounded-full transition-all duration-200
                ${isDragging ? "bg-teal-400/60 shadow-[0_0_8px_rgba(45,212,191,0.4)]" : "bg-white/10 group-hover:bg-white/20"}`}
            />

            {/* Drag handle indicator — appears on hover */}
            <div className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-200
                ${isDragging ? "opacity-100" : ""}`}>
                <svg width="6" height="10" viewBox="0 0 6 10" fill="none" className="text-white/40">
                    <path d="M5 1L1 5L5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div className="w-[2px] h-5 bg-white/30 rounded-full" />
                <svg width="6" height="10" viewBox="0 0 6 10" fill="none" className="text-white/40">
                    <path d="M1 1L5 5L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            </div>
        </div>
    );
}
