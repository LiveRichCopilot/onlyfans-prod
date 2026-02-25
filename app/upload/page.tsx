"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DropZone } from "@/components/upload/DropZone";
import { FileRow, type FileUpload } from "@/components/upload/FileRow";

function UploadInner() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    const [creatorName, setCreatorName] = useState<string | null>(null);
    const [tokenError, setTokenError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [files, setFiles] = useState<FileUpload[]>([]);
    const [uploading, setUploading] = useState(false);

    // Verify token server-side, get creator name
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
                const err = ok ? undefined : (() => { try { return JSON.parse(xhr.responseText).error; } catch { return "Upload failed"; } })();
                setFiles(prev => prev.map((x, i) => i === index ? { ...x, status: ok ? "done" : "error", progress: ok ? 100 : x.progress, error: err } : x));
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
    }, [token]);

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
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-teal-400/30 border-t-teal-400 rounded-full animate-spin" />
        </div>
    );

    if (tokenError) return (
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
            <div className="bg-white/[0.04] border border-white/[0.06] backdrop-blur-xl rounded-2xl p-8 max-w-md w-full text-center">
                <h1 className="text-xl font-semibold text-white mb-2">
                    {tokenError.includes("expired") ? "Link Expired" : "Invalid Upload Link"}
                </h1>
                <p className="text-white/50 text-sm">Please request a new upload link.</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center p-4 pt-8 pb-16">
            <div className="fixed inset-0 pointer-events-none" style={{
                background: "radial-gradient(ellipse at 50% 0%, rgba(13,148,136,0.08), transparent 60%)",
            }} />
            <div className="max-w-md w-full mx-auto relative z-10">
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-white tracking-tight">
                        Upload to <span className="text-teal-400">{creatorName}</span>&apos;s Vault
                    </h1>
                    <p className="text-white/40 text-sm mt-1">Files go directly to the OF vault</p>
                </div>

                <DropZone onFiles={addFiles} disabled={uploading} />

                {files.length > 0 && (
                    <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/[0.06] border border-amber-500/10">
                        <span className="text-amber-400/80 text-xs">Keep this tab open while uploading</span>
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
                        className="mt-4 w-full py-3.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 text-white shadow-lg shadow-pink-500/20 active:scale-[0.98] transition-all">
                        Upload {pending} file{pending !== 1 ? "s" : ""} to Vault
                    </button>
                )}

                {uploading && (
                    <div className="mt-4 w-full py-3.5 rounded-xl text-sm text-center bg-white/[0.04] border border-white/[0.06] text-white/50">
                        <span className="inline-flex items-center gap-2">
                            <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
                                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                            Uploading...
                        </span>
                    </div>
                )}

                {!uploading && files.length > 0 && pending === 0 && done > 0 && (
                    <div className="mt-4 p-4 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/10 text-center">
                        <p className="text-emerald-400 text-sm font-medium">
                            {done} file{done !== 1 ? "s" : ""} uploaded
                            {errors > 0 && <span className="text-red-400"> ({errors} failed)</span>}
                        </p>
                    </div>
                )}

                <p className="mt-8 text-center text-white/20 text-xs">Secured upload for {creatorName}</p>
            </div>
        </div>
    );
}

export default function UploadPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-teal-400/30 border-t-teal-400 rounded-full animate-spin" />
            </div>
        }>
            <UploadInner />
        </Suspense>
    );
}
