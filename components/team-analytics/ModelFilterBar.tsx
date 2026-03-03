"use client";

import { Filter, Check } from "lucide-react";

type Creator = {
  id: string;
  name: string | null;
  ofUsername: string | null;
  avatarUrl: string | null;
};

type Props = {
  creators: Creator[];
  selectedModels: Set<string>;
  showFilter: boolean;
  onToggleFilter: () => void;
  onToggleModel: (id: string) => void;
  onClearFilter: () => void;
};

export function ModelFilterBar({
  creators,
  selectedModels,
  showFilter,
  onToggleFilter,
  onToggleModel,
  onClearFilter,
}: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={onToggleFilter}
        className={`glass-button rounded-xl px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition ${
          selectedModels.size > 0 ? "text-[#5B9BD5] border-[#5B9BD5]/30" : "text-white/50"
        }`}
      >
        <Filter size={12} />
        {selectedModels.size > 0 ? `${selectedModels.size} models` : "Filter models"}
      </button>

      {showFilter && (
        <>
          <button
            onClick={onClearFilter}
            className="px-2 py-1 rounded-lg text-[10px] font-medium bg-white/5 text-white/50 hover:text-white/80 transition"
          >
            All
          </button>
          <div className="flex items-center gap-1 flex-wrap">
            {creators.map((c) => {
              const isSelected = selectedModels.has(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => onToggleModel(c.id)}
                  className={`relative flex items-center gap-1.5 rounded-full pl-1 pr-2.5 py-1 text-[10px] font-medium transition ${
                    isSelected
                      ? "bg-[#5B9BD5]/20 text-[#5B9BD5] ring-1 ring-[#5B9BD5]/40"
                      : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
                  }`}
                >
                  {c.avatarUrl ? (
                    <img
                      src={`/api/proxy-media?url=${encodeURIComponent(c.avatarUrl)}`}
                      alt=""
                      className="w-5 h-5 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[8px]">
                      {c.name ? c.name.charAt(0) : "?"}
                    </div>
                  )}
                  <span className="truncate max-w-[60px]">{c.name || c.ofUsername || "?"}</span>
                  {isSelected && <Check size={8} className="text-[#5B9BD5] ml-0.5" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
