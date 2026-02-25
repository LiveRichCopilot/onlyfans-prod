"use client";

export type FileUpload = {
    file: File;
    progress: number;
    status: "pending" | "uploading" | "done" | "error";
    error?: string;
    vaultId?: string | null;
};

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

type Props = {
    upload: FileUpload;
    onRemove?: () => void;
    canRemove: boolean;
};

export function FileRow({ upload: f, onRemove, canRemove }: Props) {
    return (
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-2xl shadow-[0_4px_16px_0_rgba(0,0,0,0.15)]">
            {/* Glass top edge highlight */}
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
            {/* Upload progress fill */}
            {f.status === "uploading" && (
                <div className="absolute inset-0 bg-gradient-to-r from-teal-500/[0.06] to-teal-400/[0.03] transition-all duration-300 ease-out" style={{ width: `${f.progress}%` }} />
            )}
            <div className="relative z-10 flex items-center gap-3 p-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-white/[0.04]">
                    <StatusIcon status={f.status} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/75 truncate font-medium">{f.file.name}</p>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-white/25">{formatSize(f.file.size)}</span>
                        {f.status === "uploading" && <span className="text-xs text-teal-400/80 tabular-nums">{f.progress}%</span>}
                        {f.status === "done" && <span className="text-xs text-emerald-400/80">In Vault</span>}
                        {f.status === "error" && <span className="text-xs text-red-400/80">{f.error}</span>}
                    </div>
                </div>
                {f.status === "uploading" && (
                    <div className="w-14 h-1.5 bg-white/[0.06] rounded-full overflow-hidden flex-shrink-0">
                        <div className="h-full bg-gradient-to-r from-teal-500 to-teal-400 rounded-full transition-all duration-300 ease-out" style={{ width: `${f.progress}%` }} />
                    </div>
                )}
                {f.status === "pending" && canRemove && onRemove && (
                    <button onClick={e => { e.stopPropagation(); onRemove(); }}
                        className="flex-shrink-0 w-7 h-7 rounded-xl flex items-center justify-center text-white/15 hover:text-white/40 hover:bg-white/[0.06] transition-all duration-200">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                )}
            </div>
        </div>
    );
}

function StatusIcon({ status }: { status: FileUpload["status"] }) {
    if (status === "pending") return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/20">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
    );
    if (status === "uploading") return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-400 animate-pulse">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
        </svg>
    );
    if (status === "done") return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
        </svg>
    );
}
