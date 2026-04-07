"use client";

import { useState } from "react";

type Model = {
  id: string;
  name: string;
  ofUsername: string | null;
  avatarUrl: string | null;
};

export function Models({
  myModels,
  otherModels,
  selectedId,
  onSelect,
}: {
  myModels: Model[];
  otherModels: Model[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <div>
      <div className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">Models</div>
      <div className="flex flex-wrap items-center gap-3">
        {myModels.map((m) => {
          const isSelected = m.id === selectedId;
          return (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              className={
                "flex items-center gap-3 px-4 py-2.5 rounded-2xl border transition " +
                (isSelected
                  ? "bg-teal-500/20 border-teal-500/50 text-white shadow-lg shadow-teal-900/30"
                  : "glass-panel border-white/10 text-white/70 hover:text-white hover:border-white/30")
              }
            >
              {m.avatarUrl ? (
                <img
                  src={`/api/proxy-media?url=${encodeURIComponent(m.avatarUrl)}`}
                  alt={m.name}
                  className="w-8 h-8 rounded-full border border-white/20 object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs border border-white/20">
                  {m.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="text-left">
                <div className="text-sm font-semibold">{m.name}</div>
                {m.ofUsername && (
                  <div className="text-[10px] text-white/40">@{m.ofUsername}</div>
                )}
              </div>
            </button>
          );
        })}

        {otherModels.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              className="glass-panel border border-white/10 text-white/60 hover:text-white hover:border-white/30 rounded-2xl px-4 py-2.5 text-sm font-semibold transition flex items-center gap-2"
            >
              Other models
              <span className="text-[10px] text-white/40">({otherModels.length})</span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="currentColor"
                className={"transition-transform " + (dropdownOpen ? "rotate-180" : "")}
              >
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
            </button>
            {dropdownOpen && (
              <div className="absolute top-full mt-2 left-0 z-50 glass-panel rounded-2xl border border-white/10 p-2 min-w-[240px] max-h-[400px] overflow-y-auto shadow-2xl">
                {otherModels.map((m) => {
                  const isSelected = m.id === selectedId;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        onSelect(m.id);
                        setDropdownOpen(false);
                      }}
                      className={
                        "w-full flex items-center gap-3 px-3 py-2 rounded-xl transition text-left " +
                        (isSelected
                          ? "bg-teal-500/20 text-white"
                          : "text-white/70 hover:bg-white/5 hover:text-white")
                      }
                    >
                      {m.avatarUrl ? (
                        <img
                          src={`/api/proxy-media?url=${encodeURIComponent(m.avatarUrl)}`}
                          alt={m.name}
                          className="w-7 h-7 rounded-full border border-white/10 object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs border border-white/10 flex-shrink-0">
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{m.name}</div>
                        {m.ofUsername && (
                          <div className="text-[10px] text-white/40 truncate">@{m.ofUsername}</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
