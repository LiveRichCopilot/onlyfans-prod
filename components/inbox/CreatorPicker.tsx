"use client";

type Props = {
    creators: any[];
    selectedCreatorId: string;
    onSelect: (id: string) => void;
};

export function CreatorPicker({ creators, selectedCreatorId, onSelect }: Props) {
    const linkedCount = creators.filter((c) => c.ofapiToken && c.ofapiToken !== "unlinked").length;

    return (
        <div className="p-3 border-b border-white/[0.06] bg-white/[0.02]">
            <select
                value={selectedCreatorId}
                onChange={(e) => onSelect(e.target.value)}
                className="w-full bg-white/[0.06] text-sm text-white rounded-xl px-3 py-2.5 outline-none border border-white/[0.08] focus:border-teal-500/50 transition-colors appearance-none"
            >
                <option value="all" className="text-black">
                    All Creators ({linkedCount})
                </option>
                {creators
                    .filter((c) => c.ofapiToken && c.ofapiToken !== "unlinked")
                    .map((c) => (
                        <option key={c.id} value={c.id} className="text-black">
                            {c.name || c.ofUsername || "Unnamed"}
                        </option>
                    ))}
            </select>
        </div>
    );
}
