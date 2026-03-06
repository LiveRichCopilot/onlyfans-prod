"use client";

import { useState } from "react";
import { X, ChevronsRight } from "lucide-react";

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
  onFillWeek?: (creatorId: string, chatterEmail: string, chatterName: string, shiftType: string) => void;
  isLive?: boolean;
};

export function ShiftBlock({
  shiftId,
  chatterEmail,
  chatterName,
  creatorId,
  dayOfWeek,
  shiftType,
  onRemove,
  onFillWeek,
  isLive,
}: Props) {
  const color = getChatterColor(chatterEmail);
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (confirmDelete) {
      onRemove(shiftId);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 2000);
    }
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
      {isLive && (
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
      )}
      <span
        className="text-[11px] font-medium truncate flex-1"
        style={{ color: `${color}dd` }}
      >
        {chatterName}
      </span>
      <div className="flex items-center gap-1.5 ml-1">
        {onFillWeek && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFillWeek(creatorId, chatterEmail, chatterName, shiftType);
            }}
            title="Fill all days"
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-[#5B9BD5]/20"
          >
            <ChevronsRight size={10} className="text-[#5B9BD5]/60" />
          </button>
        )}
        <button
          onClick={handleDelete}
          title={confirmDelete ? "Click again to confirm" : "Remove"}
          className={`transition-all p-0.5 rounded ${
            confirmDelete
              ? "bg-red-500/20 ring-1 ring-red-500/40"
              : "opacity-40 hover:opacity-100 hover:bg-red-500/20"
          }`}
        >
          <X size={10} className={confirmDelete ? "text-red-400" : "text-white/40"} />
        </button>
      </div>
    </div>
  );
}
