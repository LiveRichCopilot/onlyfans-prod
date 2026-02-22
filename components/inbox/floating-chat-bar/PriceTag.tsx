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
                <div className="flex items-center bg-black/40 border border-teal-500/30 rounded-xl px-2 py-1">
                    <span className="text-teal-400 text-sm font-bold">$</span>
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
                        ? "bg-teal-500/10 text-teal-400 border border-teal-500/20"
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
