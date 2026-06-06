"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, X } from "lucide-react";
import { ds } from "@/lib/ds";

const REPO_URL = "https://github.com/PRODHOSH/gssoc-tracker";
const LS_KEY = "gssoc_star_v1";

type ShowState = "hidden" | "card" | "corner";

export function StarNudge({ username }: { username: string }) {
  const [show, setShow] = useState<ShowState>("hidden");

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY);
    if (stored === "done") return;
    if (stored === "skip") { setShow("corner"); return; }

    let timer: ReturnType<typeof setTimeout> | null = null;

    fetch(`/api/check-star?user=${encodeURIComponent(username)}`)
      .then((r) => r.json())
      .then(({ starred }: { starred: boolean }) => {
        if (starred) { localStorage.setItem(LS_KEY, "done"); return; }
        timer = setTimeout(() => setShow("card"), 4000);
      })
      .catch(() => {
        timer = setTimeout(() => setShow("card"), 4000);
      });

    return () => { if (timer) clearTimeout(timer); };
  }, [username]);

  function onStar() {
    window.open(REPO_URL, "_blank", "noopener,noreferrer");
    localStorage.setItem(LS_KEY, "done");
    setShow("hidden");
  }

  function onDismiss() {
    localStorage.setItem(LS_KEY, "skip");
    setShow("corner");
  }

  return (
    <AnimatePresence>
      {show === "card" && (
        /* Fade overlay — centers the card without messing with scale */
        <motion.div
          key="star-card"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          style={{
            position: "fixed", inset: 0, zIndex: 9000,
            display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          {/* Card — scale spring */}
          <motion.div
            initial={{ scale: 0.94, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.94, y: 10 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            style={{
              pointerEvents: "auto",
              width: 300,
              background: ds.canvas,
              border: `1px solid ${ds.hairlineCool}`,
              borderRadius: ds.rXl,
              boxShadow: "0 16px 48px rgba(23,23,23,0.14)",
              overflow: "hidden",
              fontFamily: "var(--font-sans)",
            }}
          >
            {/* Header */}
            <div style={{
              padding: "14px 16px 12px",
              borderBottom: `1px solid ${ds.hairlineCool}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 7,
                  background: "rgba(202,138,4,0.08)",
                  border: "1px solid rgba(202,138,4,0.18)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Star size={13} color={ds.gold} fill="rgba(202,138,4,0.3)" strokeWidth={1.5} />
                </div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: ds.ink }}>
                  Enjoying GSSoC Tracker?
                </p>
              </div>
              <button
                onClick={onDismiss}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: ds.inkFaint, padding: 3, display: "flex", lineHeight: 1,
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: "14px 16px 16px" }}>
              <p style={{ margin: "0 0 14px", fontSize: 13, color: ds.inkMute, lineHeight: 1.6 }}>
                It&apos;s free, no ads, built for the community. A GitHub star takes two seconds and genuinely helps.
              </p>
              <div style={{ display: "flex", gap: 7 }}>
                <button
                  onClick={onStar}
                  style={{
                    flex: 1, padding: "9px", borderRadius: ds.rSm, border: "none",
                    background: ds.primary, color: ds.onPrimary,
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    transition: "opacity 0.13s",
                  }}
                >
                  <Star size={13} fill={ds.onPrimary} strokeWidth={0} /> Star on GitHub
                </button>
                <button
                  onClick={onDismiss}
                  style={{
                    padding: "9px 12px", borderRadius: ds.rSm,
                    border: `1px solid ${ds.hairlineCool}`,
                    background: "transparent",
                    fontSize: 12, color: ds.inkMute2, cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Maybe later
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {show === "corner" && (
        <motion.div
          key="star-corner"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ type: "spring", stiffness: 350, damping: 28 }}
          style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9000 }}
        >
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => { localStorage.setItem(LS_KEY, "done"); setShow("hidden"); }}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: ds.rFull,
              background: ds.canvas,
              border: `1px solid ${ds.hairline}`,
              color: ds.inkMute,
              fontSize: 12, fontWeight: 600,
              textDecoration: "none",
              boxShadow: "0 4px 16px rgba(23,23,23,0.12)",
            }}
          >
            <Star size={12} color={ds.gold} fill={ds.gold} strokeWidth={0} /> Star
          </a>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
