"use client";

const TIMEZONES = {
    LA: { label: "LA (PST)", offset: -8 },
    FL: { label: "FL (EST)", offset: -5 },
    PH: { label: "PH (PHT)", offset: 8 },
    UK: { label: "UK (GMT)", offset: 0 },
};

type Props = {
    selected: string;
    onSelect: (tz: string) => void;
};

export { TIMEZONES };

export function TimezoneBar({ selected, onSelect }: Props) {
    return (
        <div className="flex gap-1 p-3 border-b border-white/10 bg-black/20">
            {(Object.keys(TIMEZONES) as Array<keyof typeof TIMEZONES>).map((tz) => (
                <button
                    key={tz}
                    onClick={() => onSelect(tz)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        selected === tz
                            ? "bg-teal-500/20 text-teal-400 border border-teal-500/30"
                            : "text-white/50 hover:bg-white/5"
                    }`}
                >
                    {TIMEZONES[tz].label}
                </button>
            ))}
        </div>
    );
}
