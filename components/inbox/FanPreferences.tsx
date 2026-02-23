"use client";

import { useState, useCallback } from "react";

type Preference = {
    tag: string;
    weight: number;
    source: string | null;
};

type Intelligence = {
    stage: string | null;
    fanType: string | null;
    tonePreference: string | null;
    priceRange: string | null;
    buyerType: string | null;
    intentScore: number | null;
    timeWasterScore: number | null;
    [key: string]: any;
};

type Props = {
    preferences: Preference[];
    intelligence: Intelligence | null;
    loading: boolean;
    fanOfapiId?: string;
    creatorId?: string;
    onUpdate?: () => void;
};

// Predefined tag categories for quick-add
const TAG_CATEGORIES = {
    "Content": ["roleplay", "customs", "gfe", "audio", "video", "photos", "sexting", "dick_ratings"],
    "Style": ["dominant", "submissive", "bratty", "romantic", "playful", "direct"],
    "Behavior": ["tipper", "ppv_buyer", "custom_buyer", "whale", "window_shopper", "time_waster"],
};

// Fan type options
const FAN_TYPES = ["submissive", "dominant", "romantic", "transactional", "lonely"];
const TONE_OPTIONS = ["playful", "assertive", "romantic", "direct", "calm", "witty"];
const STAGE_OPTIONS = ["new", "warming", "active_buyer", "cooling_off", "at_risk", "churned", "reactivated"];

// Tag color by category
function tagColor(tag: string): string {
    const contentTags = ["roleplay", "customs", "gfe", "audio", "video", "photos", "sexting", "dick_ratings"];
    const styleTags = ["dominant", "submissive", "bratty", "romantic", "playful", "direct"];
    const behaviorTags = ["tipper", "ppv_buyer", "custom_buyer", "whale", "window_shopper", "time_waster"];

    if (contentTags.includes(tag)) return "#A78BFA"; // violet
    if (styleTags.includes(tag)) return "#F472B6";   // pink
    if (behaviorTags.includes(tag)) return "#22D3EE"; // cyan
    return "#2DD4BF"; // teal default
}

export function FanPreferences({ preferences, intelligence, loading, fanOfapiId, creatorId, onUpdate }: Props) {
    const [showPicker, setShowPicker] = useState(false);
    const [showFieldPicker, setShowFieldPicker] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const canEdit = Boolean(fanOfapiId && creatorId);

    const saveTag = useCallback(async (tag: string) => {
        if (!fanOfapiId || !creatorId) return;
        setSaving(true);
        try {
            await fetch("/api/inbox/fan-tag", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fanOfapiId,
                    creatorId,
                    action: "add_preference",
                    tag,
                    weight: 1.0,
                }),
            });
            onUpdate?.();
        } catch (e) {
            console.error("Save tag error:", e);
        }
        setSaving(false);
        setShowPicker(false);
    }, [fanOfapiId, creatorId, onUpdate]);

    const removeTag = useCallback(async (tag: string) => {
        if (!fanOfapiId || !creatorId) return;
        setSaving(true);
        try {
            await fetch("/api/inbox/fan-tag", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fanOfapiId,
                    creatorId,
                    action: "remove_preference",
                    tag,
                }),
            });
            onUpdate?.();
        } catch (e) {
            console.error("Remove tag error:", e);
        }
        setSaving(false);
    }, [fanOfapiId, creatorId, onUpdate]);

    const setField = useCallback(async (field: string, value: string) => {
        if (!fanOfapiId || !creatorId) return;
        setSaving(true);
        try {
            await fetch("/api/inbox/fan-tag", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fanOfapiId,
                    creatorId,
                    action: "set_field",
                    field,
                    value,
                }),
            });
            onUpdate?.();
        } catch (e) {
            console.error("Set field error:", e);
        }
        setSaving(false);
        setShowFieldPicker(null);
    }, [fanOfapiId, creatorId, onUpdate]);

    const existingTags = new Set(preferences.map(p => p.tag));

    return (
        <div>
            <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-bold tracking-tight text-white/90">Preferences</h4>
                {canEdit && (
                    <button
                        onClick={() => setShowPicker(!showPicker)}
                        disabled={saving}
                        className="text-teal-400 bg-teal-500/10 px-2 py-1 rounded border border-teal-500/20 text-xs font-bold hover:bg-teal-500/20 transition-colors disabled:opacity-50"
                    >
                        {showPicker ? "Done" : "+ Tag"}
                    </button>
                )}
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-4">
                    <div className="animate-spin w-5 h-5 rounded-full border-2 border-white/10 border-t-teal-500" />
                </div>
            ) : (
                <>
                    {/* Quick-set fields: Fan Type, Tone, Stage */}
                    {canEdit && (
                        <div className="space-y-2 mb-3">
                            <FieldRow
                                label="Fan type"
                                value={intelligence?.fanType}
                                options={FAN_TYPES}
                                field="fanType"
                                showPicker={showFieldPicker}
                                onToggle={setShowFieldPicker}
                                onSet={setField}
                            />
                            <FieldRow
                                label="Tone"
                                value={intelligence?.tonePreference}
                                options={TONE_OPTIONS}
                                field="tonePreference"
                                showPicker={showFieldPicker}
                                onToggle={setShowFieldPicker}
                                onSet={setField}
                            />
                            <FieldRow
                                label="Stage"
                                value={intelligence?.stage}
                                options={STAGE_OPTIONS}
                                field="stage"
                                showPicker={showFieldPicker}
                                onToggle={setShowFieldPicker}
                                onSet={setField}
                            />
                        </div>
                    )}

                    {/* Existing tags */}
                    {preferences.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                            {preferences.map((p) => (
                                <span
                                    key={p.tag}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border cursor-default group"
                                    style={{
                                        color: tagColor(p.tag),
                                        borderColor: tagColor(p.tag) + "40",
                                        backgroundColor: tagColor(p.tag) + "15",
                                    }}
                                >
                                    {p.tag.replace(/_/g, " ")}
                                    {canEdit && (
                                        <button
                                            onClick={() => removeTag(p.tag)}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity text-white/40 hover:text-white/80 ml-0.5"
                                        >
                                            x
                                        </button>
                                    )}
                                </span>
                            ))}
                        </div>
                    ) : !showPicker ? (
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center mb-3">
                            <p className="text-xs text-white/40">No preference tags yet.</p>
                        </div>
                    ) : null}

                    {/* Tag picker */}
                    {showPicker && (
                        <div className="border border-white/[0.08] rounded-xl p-3 bg-white/[0.02] space-y-3">
                            {Object.entries(TAG_CATEGORIES).map(([category, tags]) => (
                                <div key={category}>
                                    <div className="text-[10px] text-white/40 font-semibold uppercase tracking-wider mb-1.5">{category}</div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {tags.map((tag) => {
                                            const exists = existingTags.has(tag);
                                            return (
                                                <button
                                                    key={tag}
                                                    onClick={() => !exists && saveTag(tag)}
                                                    disabled={exists || saving}
                                                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                                                        exists
                                                            ? "opacity-30 cursor-not-allowed border-white/10 text-white/30"
                                                            : "border-white/10 text-white/60 hover:border-white/20 hover:text-white/80 hover:bg-white/5"
                                                    }`}
                                                >
                                                    {tag.replace(/_/g, " ")}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// Inline field picker row
function FieldRow({
    label, value, options, field, showPicker, onToggle, onSet,
}: {
    label: string;
    value: string | null | undefined;
    options: string[];
    field: string;
    showPicker: string | null;
    onToggle: (f: string | null) => void;
    onSet: (field: string, value: string) => void;
}) {
    const isOpen = showPicker === field;
    const display = value ? value.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "Not set";

    return (
        <div>
            <div className="flex items-center justify-between">
                <span className="text-[11px] text-white/50">{label}</span>
                <button
                    onClick={() => onToggle(isOpen ? null : field)}
                    className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                        value
                            ? "text-teal-400 border-teal-500/30 bg-teal-500/10"
                            : "text-white/40 border-white/10 bg-white/5"
                    }`}
                >
                    {display}
                </button>
            </div>
            {isOpen && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                    {options.map(opt => (
                        <button
                            key={opt}
                            onClick={() => onSet(field, opt)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all ${
                                value === opt
                                    ? "bg-teal-500/20 text-teal-400 border-teal-500/30"
                                    : "border-white/10 text-white/50 hover:bg-white/5 hover:text-white/70"
                            }`}
                        >
                            {opt.replace(/_/g, " ")}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
