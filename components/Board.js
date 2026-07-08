"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Sidebar from "./Sidebar";
import DetailPanel from "./DetailPanel";
import { isNewNotice } from "@/lib/noticeFreshness";

function pickDefaultId(authorities) {
  const firstWithNotices = authorities.find((a) => (a.notices?.length ?? 0) > 0);
  return (firstWithNotices ?? authorities[0])?.id ?? null;
}

export default function Board({ authorities, healthStatus }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(() => pickDefaultId(authorities));

  // Not memoized: "new" is a function of wall-clock time, not just
  // `authorities`, so caching it in useMemo would go stale between renders.
  const newCounts = {};
  for (const a of authorities) {
    newCounts[a.id] = (a.notices ?? []).filter((n) => isNewNotice(n)).length;
  }

  const selectedAuthority = useMemo(
    () => authorities.find((a) => a.id === selectedId) ?? null,
    [authorities, selectedId]
  );

  return (
    <div className="mx-auto flex h-screen max-w-6xl flex-col bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          MBBS/BDS UG Counselling Updates
        </h1>
        <p className="hidden text-sm text-slate-500 sm:block dark:text-slate-400">
          MCC, NTA/NEET, NMC and every State Medical Counselling authority — pick one to
          see its latest updates and official link.
        </p>
      </header>

      {healthStatus && !healthStatus.healthy && (
        <Link
          href="/health"
          className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800 transition hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/60"
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
          Some sources need attention ({healthStatus.errorCount} broken, {healthStatus.emptyCount} empty,{" "}
          {healthStatus.orderMismatchCount} order mismatch) — view health check →
        </Link>
      )}

      <Sidebar
        authorities={authorities}
        selectedId={selectedId}
        onSelect={setSelectedId}
        newCounts={newCounts}
        query={query}
        onQueryChange={setQuery}
      />

      <DetailPanel authority={selectedAuthority} />
    </div>
  );
}
