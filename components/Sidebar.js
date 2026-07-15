"use client";

import { useState } from "react";

const CATEGORY_LABELS = {
  central: "Central",
  state: "State",
  institute: "Institutes",
};

const CATEGORY_ORDER = ["central", "state", "institute"];

function AuthorityPill({ authority, isSelected, onSelect, newCount }) {
  return (
    <button
      onClick={() => onSelect(authority.id)}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
        isSelected
          ? "border-slate-900 bg-slate-900 text-white shadow-sm dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
      }`}
    >
      <span>{authority.name}</span>
      {newCount > 0 && (
        <span
          className={`shrink-0 rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums ${
            isSelected
              ? "bg-white/20 text-white dark:bg-slate-900/10 dark:text-slate-900"
              : "bg-emerald-500 text-white dark:bg-emerald-500"
          }`}
        >
          {newCount}
        </span>
      )}
    </button>
  );
}

export default function Sidebar({ authorities, selectedId, onSelect, newCounts, query, onQueryChange }) {
  const categoriesPresent = CATEGORY_ORDER.filter((c) => authorities.some((a) => a.category === c));
  const [activeCategory, setActiveCategory] = useState(categoriesPresent[0] ?? CATEGORY_ORDER[0]);
  // Separate from the text search box on purpose: picking a state here is a
  // precise "show me only this state" filter, not a fuzzy text match — so it
  // can't be defeated by not knowing the exact spelling and doesn't get
  // cleared out just because the search box gets cleared.
  const [selectedState, setSelectedState] = useState("");

  const states = [...new Set(authorities.map((a) => a.state).filter(Boolean))].sort();

  const q = query.trim().toLowerCase();
  const isSearching = q.length > 0;

  // While searching or a state is picked, ignore the category tab and match
  // across everything — central/institute authorities have no state at all,
  // so restricting to activeCategory would hide results the moment a state
  // is chosen while sitting on e.g. the "Central" tab.
  const skipCategoryFilter = isSearching || selectedState.length > 0;
  const base = skipCategoryFilter ? authorities : authorities.filter((a) => a.category === activeCategory);
  const searched = isSearching
    ? base.filter(
        (a) =>
          a.name.toLowerCase().includes(q) || (a.state ?? "").toLowerCase().includes(q)
      )
    : base;
  const filtered = selectedState ? searched.filter((a) => a.state === selectedState) : searched;

  return (
    <div className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 px-4 pt-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:max-w-xl">
            <input
              type="text"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search authority or notice text…"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-slate-500 sm:flex-1 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-slate-400"
            />

            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="w-full shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 sm:w-48 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-slate-400"
            >
              <option value="">All states</option>
              {states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {!isSearching && (
            <div className="flex shrink-0 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
              {categoriesPresent.map((category) => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                    category === activeCategory
                      ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
                >
                  {CATEGORY_LABELS[category] ?? category}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto pb-4">
          {filtered.map((a) => (
            <AuthorityPill
              key={a.id}
              authority={a}
              isSelected={a.id === selectedId}
              onSelect={onSelect}
              newCount={newCounts?.[a.id] ?? 0}
            />
          ))}

          {filtered.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">No matches.</p>
          )}
        </div>
      </div>
    </div>
  );
}
