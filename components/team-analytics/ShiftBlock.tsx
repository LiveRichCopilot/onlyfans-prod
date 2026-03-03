"use client";

import { X } from "lucide-react";

// Warm pastel palette — Apple Reminders inspired
const COLORS = [
  "#5B9BD5", // cornflower
  "#E8735A", // coral
  "#D4A843", // warm amber
  "#9B8EC4", // soft purple
  "#5CB89C", // sage green
  "#C97B84", // dusty rose
  "#5DADE2", // light blue
  "#E89B6F", // warm peach
  "#8E99A4", // cool gray
  "#A569BD", // muted purple
];

export function getChatterColor(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

type Props = {
  shiftId: string;
  chatterEmail: string;
  chatterName: string;
  creatorId: string;
  dayOfWeek: number;
  shiftType: string;
  onRemove: (id: string) => void;
};

export function ShiftBlock({
  shiftId,
  chatterEmail,
  chatterName,
  creatorId,
  dayOfWeek,
  shiftType,
  onRemove,
}: Props) {
  const color = getChatterColor(chatterEmail);

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData(
      "text/plain",
      JSON.stringify({
        type: "move",
        shiftId,
        chatterEmail,
        chatterName,
        fromCreatorId: creatorId,
        fromDay: dayOfWeek,
        fromShift: shiftType,
      })
    );
    e.dataTransfer.effectAllowed = "move";
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="group flex items-center gap-1 rounded-lg px-2 py-1 cursor-grab active:cursor-grabbing transition-all hover:scale-[1.02]"
      style={{
        backgroundColor: `${color}18`,
        borderLeft: `3px solid ${color}`,
      }}
    >
      <span
        className="text-[11px] font-medium truncate flex-1"
        style={{ color: `${color}dd` }}
      >
        {chatterName}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(shiftId);
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/10"
      >
        <X size={10} className="text-white/40" />
      </button>
    </div>
  );
}
