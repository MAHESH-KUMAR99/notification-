"use client";

import { useState } from "react";
import ConfirmModal from "./ConfirmModal";

// Renders nothing for regular visitors — only mounted when useAdmin()
// already confirms a PIN is present locally (see DetailPanel.js/SearchResults.js).
// Controlled by Board's approvedIds (not its own local state) so ticking a
// notice from one place — the ticker panel, or its row wherever it appears
// in the dashboard — is instantly reflected everywhere else it's shown,
// rather than each mounted checkmark tracking its own stale copy.
// `onToggled` doubles as the optimistic-update setter and the revert path
// on failure: called with the new value immediately, then called again with
// the old value if the server rejects it.
export default function TickerStar({ noticeId, pin, approved, onInvalidPin, onToggled, onToast }) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function performToggle() {
    const next = !approved;
    onToggled(noticeId, next);
    setBusy(true);
    try {
      const res = await fetch("/api/ticker/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: noticeId, action: next ? "add" : "remove", pin }),
      });

      if (res.status === 401) {
        // The stored PIN doesn't match the server's — every further click
        // would fail identically, which looked like the app "asking for
        // the PIN again" on each try. Clearing it here forces a clean
        // re-login via the header's Admin button instead of that silent loop.
        onToggled(noticeId, !next);
        onInvalidPin?.();
        onToast?.('Wrong admin PIN — logged out, log in again', "error");
        return;
      }
      if (!res.ok) {
        onToggled(noticeId, !next);
        onToast?.("Couldn't update ticker — try again", "error");
        return;
      }
      onToast?.(next ? "Added to ticker ✓" : "Removed from ticker");
    } catch {
      onToggled(noticeId, !next);
      onToast?.("Couldn't reach the server — try again", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => !busy && setConfirming(true)}
        disabled={busy}
        title={approved ? "On MBBS Lighthouse ticker — click to remove" : "Add to MBBS Lighthouse ticker"}
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold leading-none transition ${
          approved
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-slate-300 text-transparent hover:border-emerald-400 dark:border-slate-600"
        } ${busy ? "opacity-50" : ""}`}
      >
        ✓
      </button>

      {confirming && (
        <ConfirmModal
          message={approved ? "Remove this notice from the ticker?" : "Add this notice to the MBBS Lighthouse ticker?"}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            performToggle();
          }}
        />
      )}
    </>
  );
}
