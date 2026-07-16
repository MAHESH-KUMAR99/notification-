"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "./Sidebar";
import DetailPanel from "./DetailPanel";
import SearchResults from "./SearchResults";
import TickerPanel from "./TickerPanel";
import AdminMenu from "./AdminMenu";
import Toast from "./Toast";
import { isNewNotice } from "@/lib/noticeFreshness";
import { useAdmin } from "./useAdmin";

function pickDefaultId(authorities) {
  const firstWithNotices = authorities.find((a) => (a.notices?.length ?? 0) > 0);
  return (firstWithNotices ?? authorities[0])?.id ?? null;
}

export default function Board({ authorities }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(() => pickDefaultId(authorities));
  const { isAdmin, pin, login, logout } = useAdmin();
  const [approvedIds, setApprovedIds] = useState(new Set());
  const [approvedAtById, setApprovedAtById] = useState(new Map());
  const [showTickerPanel, setShowTickerPanel] = useState(false);
  const [toast, setToast] = useState(null);

  function showToast(message, tone = "success") {
    setToast({ message, tone, key: Date.now() });
  }

  // Self-clearing rather than a fixed-duration CSS animation — restarting
  // the timer here (via the `toast.key` dependency) means two toasts fired
  // in quick succession each get their own full visible duration instead of
  // the second one's message getting cut off by the first's timer.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  // Only fetched for the admin — regular visitors never need the current
  // ticker state, and this avoids every visitor's browser hitting the
  // GitHub-backed endpoint on every page load.
  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/ticker")
      .then((res) => res.json())
      .then((data) => {
        const items = data.items ?? [];
        setApprovedIds(new Set(items.map((i) => i.id)));
        setApprovedAtById(new Map(items.map((i) => [i.id, i.approvedAt])));
      })
      .catch(() => {});
  }, [isAdmin]);

  // Keeps the ✓ marks and the "on ticker" panel in sync with each other
  // immediately after a click, rather than only reflecting reality after
  // the next full /api/ticker refetch.
  function handleToggled(noticeId, approved) {
    setApprovedIds((prev) => {
      const next = new Set(prev);
      if (approved) next.add(noticeId);
      else next.delete(noticeId);
      return next;
    });
    setApprovedAtById((prev) => {
      const next = new Map(prev);
      if (approved) next.set(noticeId, new Date().toISOString());
      else next.delete(noticeId);
      return next;
    });
  }

  const admin = isAdmin
    ? { pin, approvedIds, approvedAtById, onInvalidPin: logout, onToggled: handleToggled, onToast: showToast }
    : null;

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

  // Cross-authority notice search — lets a student search "fee refund" or
  // "counselling" once and see which states currently have a matching
  // notice, instead of clicking through all 38 one at a time. Only
  // computed when actually searching (not memoized past that) since it
  // scans every notice on every keystroke; fine at this data size.
  const q = query.trim().toLowerCase();
  const isSearchingNotices = q.length > 0;
  const noticeResults = isSearchingNotices
    ? authorities.flatMap((a) =>
        (a.notices ?? [])
          .filter((n) => n.title.toLowerCase().includes(q) || n.titleEn?.toLowerCase().includes(q))
          .map((n) => ({ notice: n, authorityId: a.id, authorityName: a.name }))
      )
    : [];

  function jumpToAuthority(id) {
    setSelectedId(id);
    setQuery("");
  }

  return (
    <div className="relative mx-auto flex h-screen max-w-6xl flex-col bg-slate-50 dark:bg-slate-950">
      <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-3.5 dark:border-slate-800 dark:bg-slate-900">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
            MBBS/BDS UG Counselling Updates
          </h1>
          <p className="hidden truncate text-xs text-slate-500 sm:block dark:text-slate-400">
            MCC, NTA/NEET, NMC and every State Medical Counselling authority, in one place
          </p>
        </div>
        <AdminMenu
          isAdmin={isAdmin}
          login={login}
          logout={logout}
          approvedCount={approvedIds.size}
          onOpenTicker={() => setShowTickerPanel((v) => !v)}
        />
      </header>

      {isAdmin && showTickerPanel && (
        <TickerPanel authorities={authorities} admin={admin} onClose={() => setShowTickerPanel(false)} />
      )}

      <Sidebar
        authorities={authorities}
        selectedId={selectedId}
        onSelect={setSelectedId}
        newCounts={newCounts}
        query={query}
        onQueryChange={setQuery}
      />

      {isSearchingNotices ? (
        <SearchResults query={query} results={noticeResults} onJump={jumpToAuthority} admin={admin} />
      ) : (
        <DetailPanel authority={selectedAuthority} admin={admin} />
      )}

      {toast && <Toast message={toast.message} tone={toast.tone} />}
    </div>
  );
}
