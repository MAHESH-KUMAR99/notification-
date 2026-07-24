"use client";

import { Icon } from "./Icons";

export default function HomeTopbar({ query, onQueryChange }) {
  return (
    <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
      <div className="flex shrink-0 items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">
          NN
        </span>
        <div className="hidden sm:block">
          <p className="text-sm font-semibold leading-tight text-slate-900">NEET Navigator</p>
          <p className="text-[11px] leading-tight text-slate-400">Counselling Updates</p>
        </div>
      </div>

      <div className="ml-1 flex min-w-0 flex-1 items-center">
        <div className="relative min-w-0 w-full max-w-xl">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search authority or notice text…"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-slate-400 focus:bg-white"
          />
        </div>
      </div>
    </header>
  );
}
