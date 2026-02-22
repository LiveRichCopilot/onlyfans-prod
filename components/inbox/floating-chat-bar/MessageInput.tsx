"use client";

type Props = {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSend: () => void;
    disabled: boolean;
};

export function MessageInput({ value, onChange, onSend, disabled }: Props) {
    return (
        <input
            type="text"
            value={value}
            onChange={onChange}
            onKeyDown={(e) => e.key === "Enter" && onSend()}
            placeholder="Type a message to send directly to OnlyFans..."
            className="flex-1 bg-transparent border-none outline-none px-3 py-2 text-sm text-white placeholder-white/30"
            disabled={disabled}
        />
    );
}
