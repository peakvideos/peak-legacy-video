import { NextResponse } from "next/server";
import { getAvailability, ptToday } from "@/lib/google-calendar";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? "";

  if (!ISO_DATE_RE.test(date)) {
    return NextResponse.json(
      { error: "Invalid or missing 'date' query param. Expected YYYY-MM-DD." },
      { status: 400 },
    );
  }

  const [y, m, d] = date.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() !== m - 1 ||
    probe.getUTCDate() !== d
  ) {
    return NextResponse.json({ error: "Invalid calendar date." }, { status: 400 });
  }

  const dow = probe.getUTCDay();
  if (dow === 0 || dow === 6) {
    return NextResponse.json({ slots: [], reason: "weekend" });
  }

  if (date < ptToday()) {
    return NextResponse.json({ slots: [], reason: "past" });
  }

  try {
    const slots = await getAvailability(date);
    return NextResponse.json({ slots: slots.map((s) => s.label) });
  } catch (err) {
    console.error("availability error", err);
    return NextResponse.json(
      { error: "Failed to fetch availability." },
      { status: 500 },
    );
  }
}
