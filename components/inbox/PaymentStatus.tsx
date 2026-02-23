"use client";

import { Lock, DollarSign } from "lucide-react";

type Props = {
    price: number;
    isPaid: boolean;
    paidAt?: string;
    isTip?: boolean;
};

export function PaymentStatus({ price, isPaid, paidAt, isTip }: Props) {
    if (isTip) {
        return (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-b-[20px] -mx-3.5 -mb-2 mt-1.5 bg-[#1a3a2a] border-t border-white/[0.08]">
                <DollarSign size={12} className="text-emerald-400" />
                <span className="text-[12px] font-semibold text-emerald-400">
                    ${price.toFixed(2)} tip
                </span>
            </div>
        );
    }

    if (isPaid) {
        const time = paidAt
            ? new Date(paidAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
            : "";
        return (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-b-[20px] -mx-3.5 -mb-2 mt-1.5 bg-[#1a3a2a] border-t border-white/[0.08]">
                <Lock size={11} className="text-emerald-400" />
                <span className="text-[12px] font-semibold text-emerald-400">
                    ${price.toFixed(2)} paid
                </span>
                {time && <span className="text-[11px] text-emerald-400/60 ml-1">at {time}</span>}
            </div>
        );
    }

    // Not paid yet — muted maroon
    return (
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-b-[20px] -mx-3.5 -mb-2 mt-1.5 bg-[#3a1a1a] border-t border-white/[0.08]">
            <Lock size={11} className="text-[#c27a7a]" />
            <span className="text-[12px] font-semibold text-[#c27a7a]">
                ${price.toFixed(2)} not paid yet
            </span>
        </div>
    );
}
