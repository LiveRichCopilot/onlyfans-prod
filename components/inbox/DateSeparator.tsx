"use client";

type Props = { label: string };

export function DateSeparator({ label }: Props) {
    return (
        <div className="flex justify-center my-4">
            <span className="text-[11px] text-white/35 font-medium bg-white/[0.04] backdrop-blur-md px-3 py-1 rounded-full border border-white/[0.06]">
                {label}
            </span>
        </div>
    );
}
