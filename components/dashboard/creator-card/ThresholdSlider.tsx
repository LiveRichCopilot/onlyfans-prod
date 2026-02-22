"use client";

type Props = {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    unit: string;
    color?: string;
};

export function ThresholdSlider({ label, value, min, max, step, unit, color = "teal-500" }: Props) {
    return (
        <div>
            <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">{label}</label>
                <span className={`text-xs text-${color} font-medium`}>${value}{unit}</span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                defaultValue={value}
                className={`w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-${color}`}
            />
        </div>
    );
}
