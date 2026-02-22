"use client";

import { Image as ImageIcon } from "lucide-react";

export function PhotoUploader() {
    const handleClick = () => {
        // Will open file picker for local media upload
        console.log("Photo uploader clicked");
    };

    return (
        <button
            onClick={handleClick}
            className="p-2.5 text-white/40 hover:bg-white/10 hover:text-white rounded-xl transition-colors"
            title="Upload Local Media"
        >
            <ImageIcon size={20} />
        </button>
    );
}
