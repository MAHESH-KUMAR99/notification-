"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "./Sidebar";
import DetailPanel from "./DetailPanel";
import { getSeenIds, hasSeenRecord, markSeen } from "@/lib/seenNotices";

function pickDefaultId(authorities) {
  const firstWithNotices = authorities.find((a) => (a.notices?.length ?? 0) > 0);
  return (firstWithNotices ?? authorities[0])?.id ?? null;
}

export default function Board({ authorities }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(() => pickDefaultId(authorities));
  // Starts empty on both server and first client render (localStorage isn't
  // available during SSR) so no badges flash on load — populated for real
  // right after mount, once we know what this browser has already seen.
  const [newCounts, setNewCounts] = useState({});

  function recomputeNewCounts() {
    const counts = {};
    for (const a of authorities) {
      const seen = getSeenIds(a.id);
      counts[a.id] = (a.notices ?? []).filter((n) => !seen.has(n.id)).length;
    }
    setNewCounts(counts);
  }

  const selectedAuthority = useMemo(
    () => authorities.find((a) => a.id === selectedId) ?? null,
    [authorities, selectedId]
  );

  function markAuthoritySeen(id) {
    const authority = authorities.find((a) => a.id === id);
    if (!authority) return;
    markSeen(id, (authority.notices ?? []).map((n) => n.id));
    recomputeNewCounts();
  }

  function handleSelect(id) {
    setSelectedId(id);
    markAuthoritySeen(id);
  }

  useEffect(() => {
    // First-ever visit to this browser: baseline every authority's current
    // notices as already "seen" instead of flagging the entire pre-existing
    // backlog as new — a badge should only ever mean "posted after you
    // started using this site", not "everything that already existed".
    for (const a of authorities) {
      if (!hasSeenRecord(a.id)) {
        markSeen(a.id, (a.notices ?? []).map((n) => n.id));
      }
    }
    // The initially-selected authority is shown immediately, so re-mark it
    // seen in case new notices arrived since the last visit.
    if (selectedId) markAuthoritySeen(selectedId);
    recomputeNewCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      <Sidebar
        authorities={authorities}
        selectedId={selectedId}
        onSelect={handleSelect}
        newCounts={newCounts}
        query={query}
        onQueryChange={setQuery}
      />

      <DetailPanel authority={selectedAuthority} />
    </div>
  );
}
