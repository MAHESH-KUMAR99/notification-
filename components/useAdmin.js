"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "adminPin";
const CHANGE_EVENT = "adminPinChange";

// The stored PIN is only ever used client-side to decide whether to render
// the ⭐ toggle button — it is NOT trusted as proof of identity. Every
// actual toggle request re-sends this value and the server (lib/adminAuth.js)
// re-checks it against the real env-var secret, so a tampered localStorage
// value just causes toggle requests to fail with 401, not a security hole.
//
// useSyncExternalStore (not useState+useEffect) because localStorage is an
// external store React doesn't own — this is the pattern React itself
// recommends for that, and it sidesteps the eslint rule against setState
// calls inside effect bodies. The native "storage" event only fires in
// *other* tabs, so login()/logout() also dispatch a same-tab custom event
// to make this tab's own re-render happen immediately.
function subscribe(callback) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

function getSnapshot() {
  return localStorage.getItem(STORAGE_KEY);
}

function getServerSnapshot() {
  return null;
}

export function useAdmin() {
  const pin = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function login() {
    const entered = window.prompt("Admin PIN:");
    if (!entered) return;
    localStorage.setItem(STORAGE_KEY, entered);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return { isAdmin: Boolean(pin), pin, login, logout };
}
