"use client";

type Props = {
    children: React.ReactNode;
    className?: string;
    glow?: string;
};

export function GlassCard({ children, className = "", glow }: Props) {
    return (
        <div className={`relative bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl overflow-hidden group hover:border-white/[0.1] transition-all duration-300 ${className}`}>
            {glow && (
                <div
                    className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl pointer-events-none opacity-15 group-hover:opacity-30 transition-opacity duration-500"
                    style={{ background: glow }}
                />
            )}
            {children}
        </div>
    );
}
