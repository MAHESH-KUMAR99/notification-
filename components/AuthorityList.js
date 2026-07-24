"use client";

import { useState } from "react";
import { Icon } from "./Icons";

// Left list panel: title + state dropdown up top, a scrollable column of
// authority rows below, filtered by the rail's category, the state
// dropdown, and the topbar's search text.
export default function AuthorityList({ authorities, category, selectedId, onSelect, newCounts, query }) {
  // Separate from the topbar's text search on purpose: picking a state here
  // is a precise "show me only this state" filter, not a fuzzy text match —
  // so it can't be defeated by not knowing the exact spelling and doesn't
  // get cleared out just because the search box gets cleared.
  const [selectedState, setSelectedState] = useState("");

  const states = [...new Set(authorities.map((a) => a.state).filter(Boolean))].sort();

  const q = query.trim().toLowerCase();
  const isSearching = q.length > 0;

  // While searching or a state is picked, ignore the rail's category and
  // match across everything — central/institute authorities have no state
  // at all, so restricting to the active category would hide results the
  // moment a state is chosen while sitting on e.g. the "Central" filter.
  const skipCategoryFilter = isSearching || selectedState.length > 0 || !category;
  const base = skipCategoryFilter ? authorities : authorities.filter((a) => a.category === category);
  const searched = isSearching
    ? base.filter((a) => a.name.toLowerCase().includes(q) || (a.state ?? "").toLowerCase().includes(q))
    : base;
  const filtered = selectedState ? searched.filter((a) => a.state === selectedState) : searched;

  return (
    <>
      <div className="flex items-center justify-between gap-3 p-4 pb-3">
        <h1 className="text-lg font-semibold text-slate-900">Notices</h1>
        <select
          value={selectedState}
          onChange={(e) => setSelectedState(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 outline-none focus:border-slate-400"
        >
          <option value="">All states</option>
          {states.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 pb-4">
        {filtered.map((a) => {
          const isActive = a.id === selectedId;
          const newCount = newCounts?.[a.id] ?? 0;
          return (
            <button
              key={a.id}
              onClick={() => onSelect(a.id)}
              className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-3 text-left text-sm font-medium transition-colors ${
                isActive
                  ? "border-orange-200 bg-orange-50 text-slate-900"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span className="min-w-0 truncate">
                {a.name}
                {a.state && <span className="ml-1.5 font-normal text-slate-400">· {a.state}</span>}
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                {newCount > 0 && (
                  <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">
                    {newCount}
                  </span>
                )}
                <Icon name="chevronRight" className="h-4 w-4 text-slate-400" />
              </span>
            </button>
          );
        })}

        {filtered.length === 0 && <p className="px-1 text-sm text-slate-500">No matches.</p>}
      </nav>
    </>
  );
}
