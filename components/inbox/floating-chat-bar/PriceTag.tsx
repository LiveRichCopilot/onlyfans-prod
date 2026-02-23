"use client";

import { useState } from "react";

type Props = {
    price: string;
    onPriceChange: (price: string) => void;
    suggestedPrice?: number; // AI-suggested price from elastic pricing engine
};

export function PriceTag({ price, onPriceChange, suggestedPrice }: Props) {
    const [editing, setEditing] = useState(false);

    return (
        <div className="relative">
            {editing ? (
                <div className="flex items-center bg-black/40 border border-[#2d786e]/30 rounded-xl px-2 py-1">
                    <span className="text-[#2d786e] text-sm font-bold">$</span>
                    <input
                        type="text"
                        value={price}
                        onChange={(e) => onPriceChange(e.target.value.replace(/[^0-9.]/g, ""))}
                        onBlur={() => setEditing(false)}
                        onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
                        autoFocus
                        className="bg-transparent border-none outline-none text-sm text-white w-12 ml-1"
                        placeholder="0"
                    />
                </div>
            ) : (
                <button
                    onClick={() => setEditing(true)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-sm font-medium transition-colors ${price && parseFloat(price) > 0
                        ? "bg-[#2d786e]/10 text-[#2d786e] border border-[#2d786e]/20"
                        : "text-white/40 hover:bg-white/10 hover:text-white"
                    }`}
                    title="Set PPV Price"
                >
                    <span className="font-bold">$</span>
                    <span>{price || "0"}</span>
                </button>
            )}
            {suggestedPrice && suggestedPrice > 0 && (
                <button
                    onClick={() => onPriceChange(String(suggestedPrice))}
                    className="absolute -bottom-5 left-0 right-0 text-center text-[9px] text-amber-400/60 hover:text-amber-400 transition-colors whitespace-nowrap"
                >
                    AI: ${suggestedPrice}
                </button>
            )}
        </div>
    );
}
