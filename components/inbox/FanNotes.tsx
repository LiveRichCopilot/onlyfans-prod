"use client";

export function FanNotes() {
    return (
        <div>
            <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-bold tracking-tight text-white/90">Notes</h4>
                <button className="text-teal-400 bg-teal-500/10 px-2 py-1 rounded border border-teal-500/20 text-xs font-bold hover:bg-teal-500/20 transition-colors">+ Add</button>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                <p className="text-xs text-white/40">No CRM notes saved yet.</p>
            </div>
        </div>
    );
}
