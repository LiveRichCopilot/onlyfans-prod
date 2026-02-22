"use client";

type Props = {
    isAuthenticating: boolean;
    onClick: (e: React.MouseEvent) => void;
};

export function ConnectButton({ isAuthenticating, onClick }: Props) {
    return (
        <button
            onClick={onClick}
            disabled={isAuthenticating}
            className="glass-button px-3 py-1.5 rounded-xl text-xs font-medium text-purple-400 border border-purple-500/30 hover:bg-purple-500/10 flex items-center gap-2 relative z-10"
        >
            {isAuthenticating ? "Connecting..." : "Connect OF"}
        </button>
    );
}
