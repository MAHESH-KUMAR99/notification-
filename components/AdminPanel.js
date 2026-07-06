"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function AdminRow({ authority, onSaved }) {
  const [latestUpdate, setLatestUpdate] = useState(authority.latestUpdate);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  const dirty = latestUpdate !== authority.latestUpdate;

  async function handleSave() {
    setSaving(true);
    const res = await fetch("/api/authorities", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: authority.id, latestUpdate }),
    });
    setSaving(false);
    if (res.ok) {
      const updated = await res.json();
      setSavedAt(Date.now());
      onSaved(updated);
    }
  }

  return (
    <tr className="border-b border-slate-200 last:border-0 dark:border-slate-800">
      <td className="py-3 pr-4 align-top">
        <div className="font-medium text-slate-900 dark:text-slate-100">
          {authority.name}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {authority.category}
          {authority.state ? ` · ${authority.state}` : ""}
          {authority.notices?.length ? ` · ${authority.notices.length} auto-tracked notices` : ""}
        </div>
      </td>
      <td className="py-3 pr-4 align-top">
        <textarea
          value={latestUpdate}
          onChange={(e) => setLatestUpdate(e.target.value)}
          rows={2}
          className="w-full min-w-64 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
      </td>
      <td className="py-3 align-top">
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700 disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {savedAt && !dirty && (
          <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">Saved</div>
        )}
      </td>
    </tr>
  );
}

export default function AdminPanel({ initialAuthorities }) {
  const router = useRouter();
  const [authorities, setAuthorities] = useState(initialAuthorities);
  const [checking, setChecking] = useState(false);
  const [lastCheckResults, setLastCheckResults] = useState(null);

  function handleSaved(updated) {
    setAuthorities((prev) =>
      prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a))
    );
  }

  async function handleCheckNow() {
    setChecking(true);
    setLastCheckResults(null);
    const res = await fetch("/api/admin/check-updates", { method: "POST" });
    setChecking(false);
    if (res.ok) {
      const { results } = await res.json();
      setLastCheckResults(results);
      const refreshed = await fetch("/api/authorities");
      if (refreshed.ok) setAuthorities(await refreshed.json());
      router.refresh();
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Admin — Manage Updates
        </h1>
        <div className="flex gap-2">
          <button
            onClick={handleCheckNow}
            disabled={checking}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {checking ? "Checking…" : "Check Now"}
          </button>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Log out
          </button>
        </div>
      </div>

      {lastCheckResults && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Last check results
          </h2>
          <ul className="flex flex-col gap-1">
            {lastCheckResults.map((r) => (
              <li key={r.authorityId} className="flex items-center justify-between">
                <span className="text-slate-700 dark:text-slate-300">{r.authorityId}</span>
                {r.status === "new-notices" && (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    +{r.newCount} new notice{r.newCount === 1 ? "" : "s"} published
                  </span>
                )}
                {r.status === "unchanged" && (
                  <span className="text-slate-400">no change</span>
                )}
                {r.status === "error" && (
                  <span className="text-red-600 dark:text-red-400">error: {r.error}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <th className="py-2 pr-4 font-medium">Authority</th>
              <th className="py-2 pr-4 font-medium">Latest Update</th>
              <th className="py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {authorities.map((a) => (
              <AdminRow key={a.id} authority={a} onSaved={handleSaved} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
