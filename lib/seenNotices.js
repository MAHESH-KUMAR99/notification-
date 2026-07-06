"use client";

// Tracks which notice ids the user has already viewed per authority, purely
// client-side (localStorage) — there's no login/account system, so "seen"
// is scoped to this browser only, same as the rest of this app's state.
const STORAGE_PREFIX = "neetnav:seen:";

// Distinguishes "never visited this authority before" from "visited it when
// it genuinely had zero notices" — the former should baseline silently
// rather than flash a badge for the entire pre-existing backlog.
export function hasSeenRecord(authorityId) {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_PREFIX + authorityId) !== null;
}

export function getSeenIds(authorityId) {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + authorityId);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function markSeen(authorityId, noticeIds) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + authorityId, JSON.stringify(noticeIds));
  } catch {
    // Storage full or disabled — badges just won't clear, not fatal.
  }
}
