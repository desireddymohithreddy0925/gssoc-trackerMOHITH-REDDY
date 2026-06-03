import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

const SCORE_LABEL: Record<number, string> = {
  1: "😞 Not useful",
  2: "😕 Needs work",
  3: "😐 It's okay",
  4: "🙂 Pretty good",
  5: "😍 Love it",
};

export async function POST(req: Request) {
  try {
    const { score, comment } = (await req.json()) as { score: number; comment?: string };

    if (!score || score < 1 || score > 5) {
      return NextResponse.json({ error: "invalid score" }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    const stars = "⭐".repeat(score);
    const label = SCORE_LABEL[score] ?? score;

    await transporter.sendMail({
      from: `"GSSoC Tracker" <${process.env.SMTP_USER}>`,
      to: process.env.NOTIFY_EMAIL,
      subject: `Feedback: ${stars} ${label}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;padding:24px;border:1px solid #ededed;border-radius:12px;">
          <h2 style="margin:0 0 16px;font-size:18px;color:#171717;">New Feedback — GSSoC Tracker</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:8px 0;color:#707070;font-size:13px;width:90px;">Score</td>
              <td style="padding:8px 0;font-size:15px;font-weight:700;color:#171717;">${stars} ${label}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#707070;font-size:13px;vertical-align:top;">Comment</td>
              <td style="padding:8px 0;font-size:13px;color:#171717;">${comment ? comment.replace(/\n/g, "<br>") : "<span style='color:#b2b2b2'>No comment</span>"}</td>
            </tr>
          </table>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("feedback email error:", err);
    // Still return 200 — don't break UX if email fails
    return NextResponse.json({ ok: true });
  }
}
