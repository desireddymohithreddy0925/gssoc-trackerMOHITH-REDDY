import { NextRequest, NextResponse } from "next/server";

const OWNER = "PRODHOSH";
const REPO = "gssoc-tracker";

async function isStarredBy(user: string): Promise<boolean> {
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GH_TOKEN) {
    headers["Authorization"] = `Bearer ${process.env.GH_TOKEN}`;
  }

  let page = 1;
  while (true) {
    // Use Next.js fetch cache (revalidates every 15 min) instead of unstable_cache
    const res = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/stargazers?per_page=100&page=${page}`,
      { headers, next: { revalidate: 900 } }
    );
    if (!res.ok) return false;
    const data: { login: string }[] = await res.json();
    if (!Array.isArray(data) || data.length === 0) return false;
    if (data.some((u) => u.login.toLowerCase() === user)) return true;
    if (data.length < 100) return false;
    page++;
  }
}

export async function GET(req: NextRequest) {
  const user = req.nextUrl.searchParams.get("user")?.toLowerCase().trim();
  if (!user) return NextResponse.json({ starred: false });

  try {
    const starred = await isStarredBy(user);
    return NextResponse.json({ starred }, {
      headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=300" },
    });
  } catch {
    // Unknown error — tell client we couldn't confirm, treat as not starred
    return NextResponse.json({ starred: false });
  }
}
