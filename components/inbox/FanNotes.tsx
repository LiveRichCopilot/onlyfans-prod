"use client";

import { useState, useCallback } from "react";

type Fact = {
    key: string;
    value: string;
    confidence: number;
    source: string | null;
};

type Props = {
    facts: Fact[];
    loading: boolean;
    fanOfapiId?: string;
    creatorId?: string;
    onUpdate?: () => void;
};

// Common fact keys for quick-add
const QUICK_KEYS = [
    "hobby", "pet_name", "work_schedule", "favorite_team",
    "birthday", "location", "relationship", "occupation",
    "fetish", "trigger_topic", "avoid_topic", "nickname",
];

function keyLabel(key: string): string {
    return key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export function FanNotes({ facts, loading, fanOfapiId, creatorId, onUpdate }: Props) {
    const [showAdd, setShowAdd] = useState(false);
    const [newKey, setNewKey] = useState("");
    const [newValue, setNewValue] = useState("");
    const [saving, setSaving] = useState(false);

    const canEdit = Boolean(fanOfapiId && creatorId);

    const saveFact = useCallback(async (key: string, value: string) => {
        if (!fanOfapiId || !creatorId || !key || !value) return;
        setSaving(true);
        try {
            await fetch("/api/inbox/fan-tag", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fanOfapiId,
                    creatorId,
                    action: "add_fact",
                    key: key.toLowerCase().replace(/\s+/g, "_"),
                    value,
                }),
            });
            onUpdate?.();
            setNewKey("");
            setNewValue("");
            setShowAdd(false);
        } catch (e) {
            console.error("Save fact error:", e);
        }
        setSaving(false);
    }, [fanOfapiId, creatorId, onUpdate]);

    const removeFact = useCallback(async (key: string) => {
        if (!fanOfapiId || !creatorId) return;
        setSaving(true);
        try {
            await fetch("/api/inbox/fan-tag", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fanOfapiId,
                    creatorId,
                    action: "remove_fact",
                    key,
                }),
            });
            onUpdate?.();
        } catch (e) {
            console.error("Remove fact error:", e);
        }
        setSaving(false);
    }, [fanOfapiId, creatorId, onUpdate]);

    const existingKeys = new Set(facts.map(f => f.key));

    return (
        <div>
            <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-bold tracking-tight text-white/90">Notes</h4>
                {canEdit && (
                    <button
                        onClick={() => setShowAdd(!showAdd)}
                        disabled={saving}
                        className="text-teal-400 bg-teal-500/10 px-2 py-1 rounded border border-teal-500/20 text-xs font-bold hover:bg-teal-500/20 transition-colors disabled:opacity-50"
                    >
                        {showAdd ? "Done" : "+ Note"}
                    </button>
                )}
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-4">
                    <div className="animate-spin w-5 h-5 rounded-full border-2 border-white/10 border-t-teal-500" />
                </div>
            ) : (
                <>
                    {/* Existing facts */}
                    {facts.length > 0 ? (
                        <div className="space-y-1.5 mb-3">
                            {facts.map((f) => (
                                <div
                                    key={f.key}
                                    className="flex items-start justify-between py-2 px-3 rounded-xl bg-white/[0.03] border border-white/[0.06] group"
                                >
                                    <div className="min-w-0">
                                        <div className="text-[10px] text-white/40 uppercase tracking-wider">{keyLabel(f.key)}</div>
                                        <div className="text-sm text-white/80 mt-0.5">{f.value}</div>
                                        {f.source === "auto" && (
                                            <div className="text-[9px] text-violet-400/60 mt-0.5">AI detected</div>
                                        )}
                                    </div>
                                    {canEdit && (
                                        <button
                                            onClick={() => removeFact(f.key)}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity text-white/30 hover:text-red-400 text-xs ml-2 mt-1 flex-shrink-0"
                                        >
                                            x
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : !showAdd ? (
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center mb-3">
                            <p className="text-xs text-white/40">No notes saved yet.</p>
                        </div>
                    ) : null}

                    {/* Add new fact */}
                    {showAdd && (
                        <div className="border border-white/[0.08] rounded-xl p-3 bg-white/[0.02] space-y-3">
                            {/* Quick key buttons */}
                            <div>
                                <div className="text-[10px] text-white/40 font-semibold uppercase tracking-wider mb-1.5">Quick add</div>
                                <div className="flex flex-wrap gap-1.5">
                                    {QUICK_KEYS.filter(k => !existingKeys.has(k)).map(key => (
                                        <button
                                            key={key}
                                            onClick={() => setNewKey(key)}
                                            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                                                newKey === key
                                                    ? "bg-teal-500/20 text-teal-400 border-teal-500/30"
                                                    : "border-white/10 text-white/50 hover:border-white/20 hover:text-white/70"
                                            }`}
                                        >
                                            {keyLabel(key)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Custom key input */}
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newKey}
                                    onChange={(e) => setNewKey(e.target.value)}
                                    placeholder="Key (e.g. hobby)"
                                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-teal-500/50"
                                />
                            </div>

                            {/* Value input */}
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newValue}
                                    onChange={(e) => setNewValue(e.target.value)}
                                    placeholder="Value (e.g. gaming, basketball)"
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && newKey && newValue) saveFact(newKey, newValue);
                                    }}
                                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-teal-500/50"
                                />
                                <button
                                    onClick={() => saveFact(newKey, newValue)}
                                    disabled={!newKey || !newValue || saving}
                                    className="px-3 py-2 rounded-lg bg-teal-500/20 text-teal-400 text-sm font-semibold border border-teal-500/30 hover:bg-teal-500/30 transition-colors disabled:opacity-30"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
