"use client";

type Props = {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSend: () => void;
    disabled: boolean;
};

export function MessageInput({ value, onChange, onSend, disabled }: Props) {
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey && value.trim()) {
            e.preventDefault();
            onSend();
        }
    };

    return (
        <div className="flex-1 flex items-end bg-white/[0.06] border border-white/[0.1] rounded-[22px] px-3.5 py-2 min-h-[36px] transition-colors focus-within:border-white/[0.15]">
            <input
                type="text"
                value={value}
                onChange={onChange}
                onKeyDown={handleKeyDown}
                placeholder="Message"
                disabled={disabled}
                className="flex-1 bg-transparent text-[15px] text-white/90 placeholder-white/25 outline-none min-w-0"
            />
        </div>
    );
}
