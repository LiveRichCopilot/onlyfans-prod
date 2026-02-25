"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DropZone } from "@/components/upload/DropZone";
import { FileRow, type FileUpload } from "@/components/upload/FileRow";
import { UploadHistory, saveUploadRecord } from "@/components/upload/UploadHistory";

function UploadInner() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    const [creatorName, setCreatorName] = useState<string | null>(null);
    const [tokenError, setTokenError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [files, setFiles] = useState<FileUpload[]>([]);
    const [uploading, setUploading] = useState(false);
    const [historyRefresh, setHistoryRefresh] = useState(0);

    useEffect(() => {
        if (!token) { setTokenError("Missing upload token"); setLoading(false); return; }
        fetch(`/api/vault-upload?token=${encodeURIComponent(token)}`)
            .then(r => r.json())
            .then(d => { if (d.valid) setCreatorName(d.creatorName); else setTokenError(d.error || "Invalid link"); })
            .catch(() => setTokenError("Failed to verify link"))
            .finally(() => setLoading(false));
    }, [token]);

    // Paste support
    useEffect(() => {
        const handler = (e: ClipboardEvent) => {
            const t = e.target as HTMLElement;
            if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) return;
            if (e.clipboardData?.files?.length) { e.preventDefault(); addFiles(e.clipboardData.files); }
        };
        document.addEventListener("paste", handler);
        return () => document.removeEventListener("paste", handler);
    });

    const addFiles = useCallback((newFiles: FileList | File[]) => {
        setFiles(prev => [...prev, ...Array.from(newFiles).map((file): FileUpload => ({ file, progress: 0, status: "pending" }))]);
    }, []);

    const removeFile = useCallback((i: number) => setFiles(prev => prev.filter((_, idx) => idx !== i)), []);

    const uploadFile = useCallback(async (f: FileUpload, index: number) => {
        return new Promise<void>((resolve) => {
            const xhr = new XMLHttpRequest();
            const fd = new FormData();
            fd.append("file", f.file);
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    setFiles(prev => prev.map((x, i) => i === index ? { ...x, progress: Math.round((e.loaded / e.total) * 100) } : x));
                }
            };
            xhr.onload = () => {
                const ok = xhr.status >= 200 && xhr.status < 300;
                let vaultId: string | null = null;
                let err: string | undefined;
                if (ok) {
                    try { vaultId = JSON.parse(xhr.responseText).vaultId || null; } catch {}
                    // Save to history
                    if (creatorName) {
                        saveUploadRecord(creatorName, {
                            name: f.file.name,
                            size: f.file.size,
                            uploadedAt: new Date().toISOString(),
                            vaultId,
                        });
                        setHistoryRefresh(n => n + 1);
                    }
                } else {
                    try { err = JSON.parse(xhr.responseText).error; } catch { err = "Upload failed"; }
                }
                setFiles(prev => prev.map((x, i) => i === index ? { ...x, status: ok ? "done" : "error", progress: ok ? 100 : x.progress, error: err, vaultId } : x));
                resolve();
            };
            xhr.onerror = () => {
                setFiles(prev => prev.map((x, i) => i === index ? { ...x, status: "error", error: "Network error" } : x));
                resolve();
            };
            setFiles(prev => prev.map((x, i) => i === index ? { ...x, status: "uploading" } : x));
            xhr.open("POST", `/api/vault-upload?token=${encodeURIComponent(token!)}`);
            xhr.send(fd);
        });
    }, [token, creatorName]);

    const uploadAll = useCallback(async () => {
        setUploading(true);
        for (let i = 0; i < files.length; i++) {
            if (files[i].status === "pending") await uploadFile(files[i], i);
        }
        setUploading(false);
    }, [files, uploadFile]);

    const pending = files.filter(f => f.status === "pending").length;
    const done = files.filter(f => f.status === "done").length;
    const errors = files.filter(f => f.status === "error").length;

    if (loading) return (
        <div className="min-h-screen bg-[#050508] flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-teal-400/20 border-t-teal-400 rounded-full animate-spin" />
        </div>
    );

    if (tokenError) return (
        <div className="min-h-screen bg-[#050508] flex items-center justify-center p-6">
            {/* Ambient glow */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-red-500/[0.04] rounded-full blur-[120px]" />
            </div>
            <div className="relative bg-white/[0.03] border border-white/[0.08] backdrop-blur-2xl rounded-3xl p-8 max-w-md w-full text-center shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]">
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.1] to-transparent rounded-t-3xl" />
                <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-red-500/10 flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                </div>
                <h1 className="text-lg font-semibold text-white/90 mb-1.5">
                    {tokenError.includes("expired") ? "Link Expired" : "Invalid Upload Link"}
                </h1>
                <p className="text-white/35 text-sm">Request a new link from Telegram.</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#050508] flex flex-col items-center p-4 pt-8 pb-16">
            {/* Ambient mesh gradient */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-teal-500/[0.04] rounded-full blur-[150px]" />
                <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-pink-500/[0.02] rounded-full blur-[120px]" />
            </div>

            <div className="max-w-md w-full mx-auto relative z-10">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/[0.08] border border-teal-500/[0.12] mb-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                        <span className="text-[11px] text-teal-400/80 font-medium tracking-wide uppercase">Vault Upload</span>
                    </div>
                    <h1 className="text-2xl font-bold text-white/90 tracking-tight">
                        {creatorName}&apos;s Vault
                    </h1>
                    <p className="text-white/30 text-sm mt-1">Files upload directly to OnlyFans</p>
                </div>

                <DropZone onFiles={addFiles} disabled={uploading} />

                {files.length > 0 && (
                    <div className="mt-3 flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-amber-500/[0.04] border border-amber-500/[0.08] backdrop-blur-xl">
                        <div className="w-1 h-1 rounded-full bg-amber-400/60 flex-shrink-0" />
                        <span className="text-amber-400/60 text-xs">Keep this tab open while uploading</span>
                    </div>
                )}

                {files.length > 0 && (
                    <div className="mt-4 space-y-2">
                        {files.map((f, i) => (
                            <FileRow key={`${f.file.name}-${i}`} upload={f} canRemove={!uploading} onRemove={() => removeFile(i)} />
                        ))}
                    </div>
                )}

                {pending > 0 && !uploading && (
                    <button onClick={uploadAll}
                        className="mt-4 w-full py-3.5 rounded-2xl font-semibold text-sm bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-[0_8px_24px_-4px_rgba(236,72,153,0.3)] hover:shadow-[0_12px_28px_-4px_rgba(236,72,153,0.4)] hover:brightness-110 active:scale-[0.98] transition-all duration-200">
                        Upload {pending} file{pending !== 1 ? "s" : ""} to Vault
                    </button>
                )}

                {uploading && (
                    <div className="mt-4 w-full py-3.5 rounded-2xl text-sm text-center bg-white/[0.03] border border-white/[0.06] backdrop-blur-2xl text-white/40">
                        <span className="inline-flex items-center gap-2">
                            <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.15" />
                                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                            Uploading...
                        </span>
                    </div>
                )}

                {!uploading && files.length > 0 && pending === 0 && done > 0 && (
                    <div className="mt-4 p-4 rounded-2xl bg-emerald-500/[0.04] border border-emerald-500/[0.08] backdrop-blur-xl text-center">
                        <p className="text-emerald-400/90 text-sm font-medium">
                            {done} file{done !== 1 ? "s" : ""} in vault
                            {errors > 0 && <span className="text-red-400/80 ml-1">({errors} failed)</span>}
                        </p>
                    </div>
                )}

                {/* Upload History */}
                {creatorName && <UploadHistory creatorName={creatorName} refreshKey={historyRefresh} />}

                <p className="mt-10 text-center text-white/15 text-[11px]">Secured upload for {creatorName}</p>
            </div>
        </div>
    );
}

export default function UploadPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#050508] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-teal-400/20 border-t-teal-400 rounded-full animate-spin" />
            </div>
        }>
            <UploadInner />
        </Suspense>
    );
}
