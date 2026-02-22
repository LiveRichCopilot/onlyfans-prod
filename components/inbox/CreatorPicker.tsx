"use client";

type Props = {
    creators: any[];
    selectedCreatorId: string;
    onSelect: (id: string) => void;
};

export function CreatorPicker({ creators, selectedCreatorId, onSelect }: Props) {
    return (
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/20">
            <select
                value={selectedCreatorId}
                onChange={(e) => onSelect(e.target.value)}
                className="w-full bg-white/5 text-sm text-white rounded-xl px-3 py-2 outline-none border border-white/10 focus:border-teal-500 transition-colors appearance-none"
            >
                <option value="" className="text-black">Select a Creator</option>
                {creators.map(c => (
                    <option key={c.id} value={c.id} className="text-black">{c.name || 'Unnamed Creator'} {c.ofapiToken === 'unlinked' ? '(Unlinked)' : ''}</option>
                ))}
            </select>
        </div>
    );
}
