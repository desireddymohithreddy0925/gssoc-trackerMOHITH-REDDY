#!/usr/bin/env tsx
/**
 * GSSoC Progress Tracker — Sync Script
 *
 * Run by GitHub Actions every 6 hours.
 * 1. Fetches the full GSSoC leaderboard once
 * 2. Updates PRODHOSH's profile/history snapshots (existing behaviour)
 * 3. Loops through all subscribers — sends email if score/rank changed (or --daily)
 * 4. Updates lastScore/lastRank/lastChecked per subscriber
 * 5. Commits all data changes back to the repo
 *
 * Usage:
 *   npx tsx scripts/sync.ts           # Regular sync
 *   npx tsx scripts/sync.ts --daily   # Regular sync + daily digest for all subscribers
 */

import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";
import { buildChangeAlertHTML, buildDailyDigestHTML } from "./email-templates";

// ── Config ─────────────────────────────────────────────────────
const GITHUB_ID       = "PRODHOSH";
const GSSOC_API       = "https://gssoc.girlscript.org/api/leaderboard";
const DATA_DIR        = path.join(process.cwd(), "data");
const PROFILE_FILE    = path.join(DATA_DIR, "profile.json");
const HISTORY_FILE    = path.join(DATA_DIR, "history.json");
const NOTIFY_FILE     = path.join(DATA_DIR, "notifications.json");
const SUBSCRIBERS_FILE = path.join(DATA_DIR, "subscribers.json");
const DAILY_MODE      = process.argv.includes("--daily");
const FETCH_TIMEOUT   = 120_000;
const APP_URL         = process.env.APP_URL ?? "https://gssoc-tracker.vercel.app";

// ── Types ──────────────────────────────────────────────────────
interface ScoreBreakdown { label: string; pts: number; role: string }

interface ProfileSnapshot {
  timestamp: string;
  rank: number;
  score: number;
  role_scores: Record<string, number>;
  name: string;
  github_id: string;
  avatar_url: string;
  college: string;
  city: string;
  accepted_roles: string[];
  tracks: string[];
  tech_stack: string[];
  breakdown: ScoreBreakdown[];
  linkedin_url?: string;
}

interface HistoryEntry {
  timestamp: string;
  rank: number;
  score: number;
  role_scores: Record<string, number>;
  rank_change: number;
  score_change: number;
}

interface NotificationLog {
  timestamp: string;
  type: "change_alert" | "daily_digest";
  subject: string;
  email_sent: boolean;
  changes?: { rank_before: number; rank_after: number; score_before: number; score_after: number };
}

interface Subscriber {
  github: string;
  email: string;
  frequency: "on-change" | "daily";
  token: string;
  addedAt: string;
  lastScore: number | null;
  lastRank: number | null;
  lastChecked: string | null;
}

interface RawParticipant {
  full_name?: string;
  github_user?: string;
  github_url?: string;
  linkedin_url?: string;
  city?: string;
  college?: string;
  score?: number;
  rank?: number;
  roleScores?: Record<string, number>;
  accepted_roles?: string[];
  tech_stack?: string[];
  tracks?: string[];
  breakdown?: ScoreBreakdown[];
  [key: string]: unknown;
}

// ── File I/O ───────────────────────────────────────────────────
function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson<T>(file: string, fallback: T): T {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
  } catch { return fallback; }
}

function writeJson(file: string, data: unknown) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

// ── GSSoC API — fetch entire leaderboard once ──────────────────
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(url: string): Promise<{ results: RawParticipant[]; rateLimited: boolean }> {
  const MAX_RETRIES = 4;
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    const ac    = new AbortController();
    const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT);
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "GSSoC-Tracker/1.0" },
        signal: ac.signal,
      });

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get("Retry-After") ?? "0", 10);
        const wait = retryAfter > 0 ? retryAfter * 1000 : Math.min(10_000 * 2 ** attempt, 120_000);
        console.warn(`  ⚠️  Rate limited (429) — waiting ${Math.round(wait / 1000)}s before retry ${attempt + 1}/${MAX_RETRIES}…`);
        clearTimeout(timer);
        await sleep(wait);
        attempt++;
        continue;
      }

      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const raw = await res.json() as { participants?: RawParticipant[] } | RawParticipant[];
      const results: RawParticipant[] = Array.isArray(raw)
        ? raw
        : (raw as { participants?: RawParticipant[] }).participants ?? [];
      return { results, rateLimited: false };
    } finally {
      clearTimeout(timer);
    }
  }

  console.warn(`  ⚠️  Giving up on ${url} after ${MAX_RETRIES} retries — rate limit not lifting`);
  return { results: [], rateLimited: true };
}

async function fetchLeaderboard(needed: Set<string>): Promise<RawParticipant[]> {
  console.log("📡 Fetching GSSoC leaderboard…");
  const all: RawParticipant[] = [];
  const remaining = new Set([...needed].map(s => s.toLowerCase()));
  let page = 1;
  const PAGE_SIZE = 100;
  const MAX_PAGES = 500; // up to 50 000 participants
  const PAGE_DELAY = 500; // ms between pages to avoid rate limiting

  while (page <= MAX_PAGES) {
    if (page > 1) await sleep(PAGE_DELAY);

    const url = `${GSSOC_API}?page=${page}&limit=${PAGE_SIZE}`;
    const { results, rateLimited } = await fetchPage(url);

    if (rateLimited) {
      console.warn(`  ⚠️  Stopping pagination due to persistent rate limiting — using ${all.length} participants collected so far`);
      break;
    }
    if (results.length === 0) break;

    all.push(...results);

    for (const p of results) {
      const id = (p.github_user ?? "").toLowerCase();
      if (remaining.has(id)) remaining.delete(id);
    }

    const stillLooking = remaining.size > 0 ? [...remaining].join(", ") : "none ✅";
    console.log(`  Page ${page}: +${results.length} (total ${all.length}) — still looking for: ${stillLooking}`);

    if (remaining.size === 0) {
      console.log("  All required profiles found — stopping early.");
      break;
    }

    if (results.length < PAGE_SIZE) break; // last page
    page++;
  }

  // Fallback: if pagination returned nothing at all, try a plain fetch
  if (all.length === 0) {
    console.log("  Falling back to plain fetch…");
    const { results } = await fetchPage(GSSOC_API);
    all.push(...results);
  }

  if (remaining.size > 0) {
    console.warn(`⚠️  Not found after scanning ${all.length} participants: ${[...remaining].join(", ")} (they may not be on the leaderboard yet)`);
  }

  console.log(`✅ Leaderboard fetched — ${all.length} participants across ${page} page(s)`);
  return all;
}

function toSnapshot(p: RawParticipant): ProfileSnapshot {
  return {
    timestamp:      new Date().toISOString(),
    rank:           p.rank ?? 0,
    score:          p.score ?? 0,
    role_scores:    p.roleScores ?? {},
    name:           p.full_name ?? p.github_user ?? "Unknown",
    github_id:      p.github_user ?? "",
    avatar_url:     p.github_user ? `https://avatars.githubusercontent.com/${p.github_user}` : "",
    college:        p.college ?? "",
    city:           p.city ?? "",
    accepted_roles: p.accepted_roles ?? [],
    tracks:         p.tracks ?? [],
    tech_stack:     p.tech_stack ?? [],
    breakdown:      p.breakdown ?? [],
    linkedin_url:   p.linkedin_url,
  };
}

// ── Email ──────────────────────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) { console.warn("⚠️  SMTP not configured — skipping email"); return false; }
  try {
    const transporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
    await transporter.sendMail({ from: `GSSoC Tracker <${user}>`, to, subject, html });
    console.log(`📧 Sent to ${to}: ${subject}`);
    return true;
  } catch (e) {
    console.error(`❌ Email failed to ${to}:`, (e as Error).message);
    return false;
  }
}

// ── Main ───────────────────────────────────────────────────────
async function main() {
  ensure();
  console.log(`\n🚀 GSSoC Tracker Sync — ${DAILY_MODE ? "Daily Digest" : "Regular"} mode\n`);

  // Build the set of GitHub IDs we must locate before we can stop paginating
  const subscribersEarly = readJson<Subscriber[]>(SUBSCRIBERS_FILE, []);
  const needed = new Set<string>([GITHUB_ID, ...subscribersEarly.map(s => s.github)]);
  console.log(`🎯 Need to find: ${[...needed].join(", ")}`);

  // Fetch leaderboard once — shared by owner + all subscribers
  let list: RawParticipant[];
  try {
    list = await fetchLeaderboard(needed);
  } catch (e) {
    console.error("❌ Leaderboard fetch failed:", (e as Error).message);
    process.exit(1);
  }

  // ── 1. Owner (PRODHOSH) processing — unchanged behaviour ─────
  const existing = readJson<ProfileSnapshot | null>(PROFILE_FILE, null);
  const history  = readJson<HistoryEntry[]>(HISTORY_FILE, []);
  const notifs   = readJson<NotificationLog[]>(NOTIFY_FILE, []);

  const rawOwner = list.find(p => (p.github_user ?? "").toLowerCase() === GITHUB_ID.toLowerCase());
  if (!rawOwner) {
    console.warn(`⚠️  Owner profile ${GITHUB_ID} not found in leaderboard (may be outside fetched range) — skipping owner update`);
  }

  if (!rawOwner && existing === null) {
    console.warn(`⚠️  No existing data for ${GITHUB_ID} either — owner section skipped entirely`);
  }

  const current     = rawOwner ? toSnapshot(rawOwner) : existing!;
  const hasExisting = existing !== null;
  const scoreChanged = hasExisting && !!rawOwner && current.score !== existing.score;
  const rankChanged  = hasExisting && !!rawOwner && current.rank  !== existing.rank;
  const hasChanges   = !!rawOwner && (!hasExisting || scoreChanged || rankChanged);

  if (rawOwner || hasExisting) {
    console.log(`[${GITHUB_ID}] Score: ${existing?.score ?? "–"} → ${current?.score ?? "–"}`);
    console.log(`[${GITHUB_ID}] Rank:  #${existing?.rank ?? "–"} → #${current?.rank ?? "–"}`);
  }

  if (rawOwner && current) writeJson(PROFILE_FILE, current);

  if (hasChanges) {
    history.push({
      timestamp:    current.timestamp,
      rank:         current.rank,
      score:        current.score,
      role_scores:  current.role_scores,
      rank_change:  existing ? current.rank - existing.rank : 0,
      score_change: existing ? current.score - existing.score : 0,
    });
    writeJson(HISTORY_FILE, history);
  }

  const newNotifs: NotificationLog[] = [];
  const ownerEmail = process.env.NOTIFY_EMAIL ?? process.env.SMTP_USER;

  if (ownerEmail && hasChanges && hasExisting && (scoreChanged || rankChanged)) {
    const scoreDiff = current.score - existing!.score;
    const subject   = `GSSoC Alert: Score ${scoreDiff >= 0 ? "+" : ""}${scoreDiff} pts · Rank #${current.rank}`;
    const html      = buildChangeAlertHTML({ curr: current, prev: existing! });
    const sent      = await sendEmail(ownerEmail, subject, html);
    newNotifs.push({
      timestamp: new Date().toISOString(), type: "change_alert", subject, email_sent: sent,
      changes: { rank_before: existing!.rank, rank_after: current.rank, score_before: existing!.score, score_after: current.score },
    });
  }

  if (ownerEmail && DAILY_MODE) {
    const week     = history.slice(-28);
    const oldest   = week[0];
    const score_7d = oldest ? current.score - oldest.score : 0;
    const rank_7d  = oldest ? oldest.rank - current.rank : 0;
    const subject  = `GSSoC Daily: Score ${current.score.toLocaleString()} pts · Rank #${current.rank}`;
    const html     = buildDailyDigestHTML({ profile: current, history_count: history.length, score_7d, rank_7d });
    const sent     = await sendEmail(ownerEmail, subject, html);
    newNotifs.push({ timestamp: new Date().toISOString(), type: "daily_digest", subject, email_sent: sent });
  }

  if (newNotifs.length) writeJson(NOTIFY_FILE, [...notifs, ...newNotifs]);

  // ── 2. Subscribers ────────────────────────────────────────────
  const subscribers = readJson<Subscriber[]>(SUBSCRIBERS_FILE, []);
  if (subscribers.length === 0) {
    console.log("\n👥 No subscribers yet.");
  } else {
    console.log(`\n👥 Processing ${subscribers.length} subscriber(s)…`);
  }

  const updatedSubs: Subscriber[] = [];

  for (const sub of subscribers) {
    const raw = list.find(p => (p.github_user ?? "").toLowerCase() === sub.github.toLowerCase());
    if (!raw) {
      console.log(`  [${sub.github}] Not found in leaderboard — skipping`);
      updatedSubs.push(sub);
      continue;
    }

    const snap        = toSnapshot(raw);
    const firstTime   = sub.lastScore === null;
    const scChanged   = !firstTime && snap.score !== sub.lastScore;
    const rkChanged   = !firstTime && snap.rank  !== sub.lastRank;
    const anyChange   = scChanged || rkChanged;
    const unsubUrl    = `${APP_URL}/api/unsubscribe?token=${sub.token}`;

    const shouldAlert  = sub.frequency === "on-change" && anyChange;
    const shouldDigest = DAILY_MODE && sub.frequency === "daily";

    if (shouldAlert) {
      const scoreDiff = snap.score - (sub.lastScore ?? snap.score);
      const subject   = `GSSoC Alert: Score ${scoreDiff >= 0 ? "+" : ""}${scoreDiff} pts · Rank #${snap.rank}`;
      const html      = buildChangeAlertHTML({
        curr: snap,
        prev: { rank: sub.lastRank ?? snap.rank, score: sub.lastScore ?? snap.score, role_scores: {} },
        unsubscribeUrl: unsubUrl,
      });
      await sendEmail(sub.email, subject, html);
      console.log(`  [${sub.github}] Change alert sent (score ${sub.lastScore} → ${snap.score})`);
    } else if (shouldDigest) {
      const subject = `GSSoC Daily: ${snap.score.toLocaleString()} pts · Rank #${snap.rank}`;
      const html    = buildDailyDigestHTML({
        profile:       snap,
        history_count: history.length,
        score_7d:      0,
        rank_7d:       0,
        unsubscribeUrl: unsubUrl,
      });
      await sendEmail(sub.email, subject, html);
      console.log(`  [${sub.github}] Daily digest sent`);
    } else {
      console.log(`  [${sub.github}] Score ${snap.score}, rank #${snap.rank} — no email needed`);
    }

    updatedSubs.push({
      ...sub,
      lastScore:   snap.score,
      lastRank:    snap.rank,
      lastChecked: new Date().toISOString(),
    });
  }

  if (subscribers.length > 0) writeJson(SUBSCRIBERS_FILE, updatedSubs);

  console.log("\n✅ Sync complete");
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
