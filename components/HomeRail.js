"use client";

import { useState } from "react";
import { Icon } from "./Icons";
import TickerStar from "./TickerStar";

const CATEGORY_ITEMS = [
  { id: "central", label: "Central", icon: "central" },
  { id: "state", label: "State", icon: "state" },
  { id: "institute", label: "Institutes", icon: "institute" },
  { id: "aggregator", label: "Guidance", icon: "compass" },
];

function RailLink({ item, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      title={item.label}
      className={`flex w-full flex-col items-center gap-1.5 rounded-lg py-2 text-center transition-colors ${
        isActive ? "text-orange-600" : "text-slate-500 hover:text-slate-800"
      }`}
    >
      <Icon name={item.icon} className="h-5 w-5" />
      <span className="text-[11px] font-medium leading-tight">{item.label}</span>
    </button>
  );
}

function formatRelativeTime(iso) {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

// The admin login + ticker list, as a drawer that pushes in next to the
// icon strip when the rail's own "Admin" button is clicked — plain document
// flow (no position:fixed/absolute, no overlay), so it never covers the
// notices list, and closing it doesn't touch anything outside the rail.
function AdminDrawer({ authorities, isAdmin, pin, login, logout, approvedIds, approvedAtById, onToggled, onToast, onClose }) {
  const [pinInput, setPinInput] = useState("");

  function handleLoginSubmit(e) {
    e.preventDefault();
    if (!pinInput) return;
    login(pinInput);
    setPinInput("");
  }

  const noticeIndex = new Map();
  for (const a of authorities) {
    for (const n of a.notices ?? []) {
      noticeIndex.set(n.id, { notice: n, authorityName: a.name });
    }
  }
  const approved = isAdmin ? [...approvedIds].map((id) => noticeIndex.get(id)).filter(Boolean) : [];

  return (
    <div className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Icon name="lock" className="h-4 w-4 text-slate-500" />
          Admin
        </span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
          <Icon name="close" className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!isAdmin ? (
          <form onSubmit={handleLoginSubmit} className="flex flex-col gap-2">
            <label className="text-xs font-medium text-slate-500">Admin PIN</label>
            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Enter PIN"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
            />
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
            >
              Log in
            </button>
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Ticker list
                <span className="ml-1.5 font-normal normal-case text-slate-400">({approved.length})</span>
              </p>
              <button onClick={logout} className="text-xs font-medium text-red-500 hover:text-red-600">
                Log out
              </button>
            </div>

            {approved.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
                Nothing ticked yet — click ✓ next to a notice to add it.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                {approved.map(({ notice, authorityName }) => (
                  <li key={notice.id} className="flex items-start gap-2.5 px-3 py-2.5">
                    <TickerStar
                      noticeId={notice.id}
                      pin={pin}
                      approved={true}
                      onInvalidPin={logout}
                      onToggled={onToggled}
                      onToast={onToast}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-500">
                          {authorityName}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {formatRelativeTime(approvedAtById.get(notice.id))}
                        </span>
                      </div>
                      {notice.link ? (
                        <a
                          href={notice.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block truncate text-xs text-slate-800 hover:text-slate-950 hover:underline"
                        >
                          {notice.titleEn ?? notice.title}
                        </a>
                      ) : (
                        <p className="truncate text-xs text-slate-800">{notice.titleEn ?? notice.title}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Left icon rail — flat category list up top, a pinned "Admin" icon at the
// bottom. Clicking Admin pushes an inline drawer in next to the rail
// (ordinary flex layout, not an overlay), so the notices list and detail
// panel keep showing exactly what they were showing before.
export default function HomeRail({
  categoriesPresent,
  activeCategory,
  onSelectCategory,
  authorities,
  isAdmin,
  pin,
  login,
  logout,
  approvedIds,
  approvedAtById,
  onToggled,
  onToast,
}) {
  const [adminOpen, setAdminOpen] = useState(false);
  const items = CATEGORY_ITEMS.filter((c) => categoriesPresent.includes(c.id));

  return (
    <div className="hidden shrink-0 sm:flex">
      <aside className="flex w-24 shrink-0 flex-col gap-3 overflow-y-auto border-r border-slate-200 bg-white px-2 py-4">
        <div>
          <p className="border-b border-slate-200 pb-2 text-center text-xs font-medium text-slate-500">
            Categories
          </p>
          <div className="mt-2 flex flex-col">
            <RailLink
              item={{ id: "all", label: "All", icon: "seatMatrix" }}
              isActive={!activeCategory}
              onClick={() => onSelectCategory(null)}
            />
            {items.map((item) => (
              <RailLink
                key={item.id}
                item={item}
                isActive={activeCategory === item.id}
                onClick={() => onSelectCategory(item.id)}
              />
            ))}
          </div>
        </div>

        <div className="mt-auto flex flex-col items-center gap-1.5 border-t border-slate-200 pt-3">
          <button
            onClick={() => setAdminOpen((v) => !v)}
            title="Admin"
            className="flex flex-col items-center gap-1.5 py-1"
          >
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${
                adminOpen || isAdmin
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
              }`}
            >
              <Icon name="lock" className="h-5 w-5" />
            </span>
            <span className={`text-[11px] font-medium leading-tight ${adminOpen || isAdmin ? "text-slate-900" : "text-slate-500"}`}>
              Admin
            </span>
          </button>
        </div>
      </aside>

      {adminOpen && (
        <AdminDrawer
          authorities={authorities}
          isAdmin={isAdmin}
          pin={pin}
          login={login}
          logout={logout}
          approvedIds={approvedIds}
          approvedAtById={approvedAtById}
          onToggled={onToggled}
          onToast={onToast}
          onClose={() => setAdminOpen(false)}
        />
      )}
    </div>
  );
}
