"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

interface BackgroundSyncProps {
  username: string;
  isMentor?: boolean;
  /** True when the page loaded with zero data — show a spinner until sync done */
  isEmpty?: boolean;
}

/**
 * Fires an async sync on page load and refreshes the server component when done.
 *
 * Edge-cases handled:
 * - Duplicate effect runs (StrictMode) — guarded with a ref
 * - Sync throttle — the API returns {synced:false} when data is fresh, no refresh fired
 * - First-time user (isEmpty=true) — shows a loading overlay until data arrives
 * - GitHub API failure — silently falls back; user keeps stale data, no error shown
 * - Network offline — fetch fails silently; user still sees last known data
 * - User navigates away mid-sync — router.refresh() is a no-op on unmounted component
 * - Multiple tabs — stampede lock in DB prevents concurrent GitHub fetches
 */
export function BackgroundSync({ username, isMentor = false, isEmpty = false }: BackgroundSyncProps) {
  const router = useRouter();
  const hasRun = useRef(false);
  const [syncing, setSyncing] = useState(isEmpty); // only show spinner for new users

  useEffect(() => {
    // Strict-mode guard: only fire once per mount
    if (hasRun.current) return;
    hasRun.current = true;

    const endpoint = isMentor
      ? `/api/sync-data?username=${encodeURIComponent(username)}&mode=mentor`
      : `/api/sync-data?username=${encodeURIComponent(username)}`;

    let timer: ReturnType<typeof setTimeout> | null = null;

    // Safety: if sync takes > 45s, hide spinner anyway (don't leave user stuck)
    if (isEmpty) {
      timer = setTimeout(() => setSyncing(false), 45_000);
    }

    fetch(endpoint, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((data: { synced: boolean } | null) => {
        if (timer) clearTimeout(timer);
        if (data?.synced) {
          // New data was fetched from GitHub — tell Next.js to re-render the page
          router.refresh();
        } else {
          // Data was already fresh — no refresh needed
          setSyncing(false);
        }
      })
      .catch(() => {
        if (timer) clearTimeout(timer);
        setSyncing(false); // silent fail
      });
  }, [username, isMentor, isEmpty, router]);

  // For brand-new users, show a full-screen loading overlay until data is ready
  if (isEmpty && syncing) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--color-canvas-night, #0f0f0f)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          zIndex: 100,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: "rgba(62,207,142,0.1)",
            border: "1px solid rgba(62,207,142,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <RefreshCw size={20} color="#3ecf8e" style={{ animation: "spin 1s linear infinite" }} />
        </div>
        <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.5)" }}>
          Fetching your PRs for the first time…
        </p>
        <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
          This only happens once. Future loads will be instant.
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // For returning users, show a tiny unobtrusive chip in the top-right corner
  if (syncing) {
    return (
      <div
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "7px 12px",
          borderRadius: 9999,
          background: "rgba(62,207,142,0.1)",
          border: "1px solid rgba(62,207,142,0.2)",
          fontSize: 12,
          color: "rgba(255,255,255,0.5)",
          zIndex: 50,
          backdropFilter: "blur(8px)",
          pointerEvents: "none",
        }}
      >
        <RefreshCw size={11} color="#3ecf8e" style={{ animation: "spin 1s linear infinite" }} />
        Syncing…
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return null;
}
