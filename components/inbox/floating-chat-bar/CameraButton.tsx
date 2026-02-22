"use client";

import { Camera } from "lucide-react";

export function CameraButton() {
    return (
        <button className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-white/[0.08] text-white/50 hover:bg-white/[0.12] transition-colors">
            <Camera size={18} />
        </button>
    );
}
