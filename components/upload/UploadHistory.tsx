"use client";

import { useEffect, useState } from "react";

export type UploadRecord = {
    name: string;
    size: number;
    uploadedAt: string;
    vaultId?: string | null;
};

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function timeAgo(date: string): string {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

const STORAGE_KEY_PREFIX = "vault-uploads-";

export function getStorageKey(creatorName: string) {
    return `${STORAGE_KEY_PREFIX}${creatorName}`;
}

export function saveUploadRecord(creatorName: string, record: UploadRecord) {
    try {
        const key = getStorageKey(creatorName);
        const existing: UploadRecord[] = JSON.parse(localStorage.getItem(key) || "[]");
        existing.unshift(record);
        // Keep last 50 records
        localStorage.setItem(key, JSON.stringify(existing.slice(0, 50)));
    } catch {}
}

export function getUploadRecords(creatorName: string): UploadRecord[] {
    try {
        return JSON.parse(localStorage.getItem(getStorageKey(creatorName)) || "[]");
    } catch {
        return [];
    }
}

type Props = {
    creatorName: string;
    refreshKey: number;
};

export function UploadHistory({ creatorName, refreshKey }: Props) {
    const [records, setRecords] = useState<UploadRecord[]>([]);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        setRecords(getUploadRecords(creatorName));
    }, [creatorName, refreshKey]);

    if (records.length === 0) return null;

    const shown = expanded ? records : records.slice(0, 3);

    return (
        <div className="mt-6">
            <div className="flex items-center justify-between mb-3 px-1">
                <h2 className="text-sm font-semibold text-white/60 tracking-wide uppercase">
                    Your Uploads
                </h2>
                <span className="text-xs text-white/30">{records.length} file{records.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="space-y-1.5">
                {shown.map((r, i) => (
                    <div key={`${r.name}-${r.uploadedAt}-${i}`}
                        className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-xl"
                    >
                        <div className="flex-shrink-0 w-7 h-7 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-white/70 truncate font-medium">{r.name}</p>
                            <p className="text-[10px] text-white/25">{formatSize(r.size)}</p>
                        </div>
                        <span className="text-[10px] text-white/20 flex-shrink-0">{timeAgo(r.uploadedAt)}</span>
                    </div>
                ))}
            </div>
            {records.length > 3 && (
                <button onClick={() => setExpanded(!expanded)}
                    className="mt-2 w-full text-center text-xs text-white/30 hover:text-white/50 py-1.5 transition-colors">
                    {expanded ? "Show less" : `Show all ${records.length} uploads`}
                </button>
            )}
        </div>
    );
}
