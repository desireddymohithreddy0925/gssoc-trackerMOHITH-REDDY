"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MessageSquare } from "lucide-react";
import { ds } from "@/lib/ds";

const K_VISITS = "gssoc_nps_v";
const K_NEXT   = "gssoc_nps_next";
const K_DONE   = "gssoc_nps_done";

const RATINGS = [
  { score: 1, emoji: "😞", label: "Not useful" },
  { score: 2, emoji: "😕", label: "Needs work"  },
  { score: 3, emoji: "😐", label: "It's okay"   },
  { score: 4, emoji: "🙂", label: "Pretty good!" },
  { score: 5, emoji: "😍", label: "Love it!"     },
];

export function NpsFeedback() {
  const [visible, setVisible]   = useState(false);
  const [score, setScore]       = useState<number | null>(null);
  const [comment, setComment]   = useState("");
  const [phase, setPhase]       = useState<"ask" | "loading" | "done">("ask");
  const [hovered, setHovered]   = useState<number | null>(null);

  useEffect(() => {
    if (localStorage.getItem(K_DONE)) return;

    const visits = parseInt(localStorage.getItem(K_VISITS) ?? "0", 10) + 1;
    localStorage.setItem(K_VISITS, String(visits));

    const next = parseInt(localStorage.getItem(K_NEXT) ?? "3", 10);
    if (visits >= next) {
      const t = setTimeout(() => setVisible(true), 3500);
      return () => clearTimeout(t);
    }
  }, []);

  function later() {
    const v = parseInt(localStorage.getItem(K_VISITS) ?? "0", 10);
    localStorage.setItem(K_NEXT, String(v + 5));
    setVisible(false);
  }

  function never() {
    localStorage.setItem(K_DONE, "1");
    setVisible(false);
  }

  async function submit() {
    if (!score) return;
    setPhase("loading");

    // Submit to Google Forms (no-cors — response unreadable but submission goes through)
    const FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSdySnxt51VRosmksI7-lF1MEZpOAmaEYGC07X3Yv9KWsbgLOg/formResponse";
    fetch(FORM_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        "entry.1447509757": String(score),
        "entry.10650169": comment.trim(),
      }).toString(),
    }).catch(() => {});

    // Also send email notification
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, comment: comment.trim() }),
      });
    } catch { /* email failure shouldn't break UX */ }

    localStorage.setItem(K_DONE, "1");
    setPhase("done");
    setTimeout(() => setVisible(false), 2200);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="nps"
          initial={{ opacity: 0, y: 28, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 26 }}
          style={{
            position: "fixed", bottom: 24, right: 24, zIndex: 9000,
            width: 316,
            background: ds.canvas,
            border: `1px solid ${ds.hairlineCool}`,
            borderRadius: ds.rXl,
            boxShadow: "0 16px 48px rgba(23,23,23,0.18)",
            overflow: "hidden",
          }}
        >
          {phase === "done" ? (
            <div style={{ padding: "32px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🙏</div>
              <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: ds.ink }}>
                Thanks for the feedback!
              </p>
              <p style={{ margin: 0, fontSize: 13, color: ds.inkMute }}>
                It really helps us improve.
              </p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div style={{
                padding: "14px 16px 12px",
                borderBottom: `1px solid ${ds.hairlineCool}`,
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 7,
                    background: "rgba(62,207,142,0.1)",
                    border: "1px solid rgba(62,207,142,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <MessageSquare size={13} color={ds.primaryDeep} />
                  </div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: ds.ink }}>
                    Quick feedback
                  </p>
                </div>
                <button
                  onClick={later}
                  style={{ background: "none", border: "none", cursor: "pointer", color: ds.inkFaint, padding: 3, display: "flex", lineHeight: 1 }}
                >
                  <X size={14} />
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: "16px 16px 18px" }}>
                <p style={{ margin: "0 0 14px", fontSize: 13, color: ds.inkMute, lineHeight: 1.5 }}>
                  How useful is GSSoC Tracker for you?
                </p>

                {/* Emoji rating row */}
                <div style={{ display: "flex", justifyContent: "space-between", gap: 5, marginBottom: 6 }}>
                  {RATINGS.map((r) => {
                    const sel = score === r.score;
                    const hov = hovered === r.score;
                    return (
                      <button
                        key={r.score}
                        onClick={() => setScore(r.score)}
                        onMouseEnter={() => setHovered(r.score)}
                        onMouseLeave={() => setHovered(null)}
                        title={r.label}
                        style={{
                          flex: 1, padding: "9px 2px", borderRadius: ds.rMd,
                          border: `1.5px solid ${sel ? ds.primary : hov ? ds.hairlineStrong : ds.hairlineCool}`,
                          background: sel ? "rgba(62,207,142,0.08)" : hov ? ds.canvasSoft : "transparent",
                          cursor: "pointer", fontSize: 24, lineHeight: 1,
                          transition: "all 0.12s",
                          transform: sel || hov ? "scale(1.12)" : "scale(1)",
                        }}
                      >
                        {r.emoji}
                      </button>
                    );
                  })}
                </div>

                {/* Score label */}
                <p style={{
                  margin: "0 0 12px", fontSize: 11, fontWeight: 600, textAlign: "center",
                  color: ds.primaryDeep, minHeight: 16,
                }}>
                  {score ? RATINGS.find((r) => r.score === score)?.label : ""}
                </p>

                {/* Comment */}
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Any suggestions? (optional)"
                  rows={2}
                  style={{
                    width: "100%", padding: "8px 10px", borderRadius: ds.rSm,
                    border: `1px solid ${ds.hairline}`, background: ds.canvasSoft,
                    fontSize: 12, color: ds.ink, resize: "none", outline: "none",
                    fontFamily: "var(--font-sans)", lineHeight: 1.5,
                    boxSizing: "border-box",
                    transition: "border-color 0.13s",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(62,207,142,0.45)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = ds.hairline)}
                />

                {/* Actions */}
                <div style={{ display: "flex", gap: 7, marginTop: 10 }}>
                  <button
                    onClick={submit}
                    disabled={!score || phase === "loading"}
                    style={{
                      flex: 1, padding: "9px", borderRadius: ds.rSm, border: "none",
                      background: score ? ds.primary : ds.hairlineCool,
                      color: score ? ds.onPrimary : ds.inkFaint,
                      fontSize: 13, fontWeight: 600,
                      cursor: score ? "pointer" : "not-allowed",
                      transition: "all 0.13s",
                    }}
                  >
                    {phase === "loading" ? "Sending…" : "Submit"}
                  </button>
                  <button
                    onClick={never}
                    style={{
                      padding: "9px 12px", borderRadius: ds.rSm,
                      border: `1px solid ${ds.hairlineCool}`,
                      background: "transparent",
                      fontSize: 12, color: ds.inkMute2, cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Don&apos;t ask
                  </button>
                </div>
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
