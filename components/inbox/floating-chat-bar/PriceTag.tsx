"use client";

import { useState } from "react";

type Props = {
    price: string;
    onPriceChange: (price: string) => void;
};

export function PriceTag({ price, onPriceChange }: Props) {
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
        </div>
    );
}
