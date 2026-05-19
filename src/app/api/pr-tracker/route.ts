import { NextRequest, NextResponse } from "next/server";
import { buildPRTrackerData } from "@/lib/pr-tracker";

export const dynamic = "force-dynamic";

const USERNAME_RE = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("username")?.trim().replace(/^@/, "") ?? "";

  if (!raw) {
    return NextResponse.json({ error: "username is required", code: "INVALID_USERNAME" }, { status: 400 });
  }
  if (!USERNAME_RE.test(raw)) {
    return NextResponse.json({ error: "Invalid GitHub username", code: "INVALID_USERNAME" }, { status: 400 });
  }

  try {
    const data = await buildPRTrackerData(raw);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "USER_NOT_FOUND")
      return NextResponse.json({ error: "GitHub user not found", code: "USER_NOT_FOUND" }, { status: 404 });
    if (msg === "RATE_LIMITED")
      return NextResponse.json(
        { error: "GitHub API rate limit reached. Add a GH_TOKEN env var or try again later.", code: "RATE_LIMITED" },
        { status: 429 }
      );
    console.error("[pr-tracker]", err);
    return NextResponse.json({ error: "Failed to fetch PR data", code: "API_ERROR" }, { status: 500 });
  }
}
