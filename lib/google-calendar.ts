import "server-only";
import { google, type calendar_v3 } from "googleapis";

const TIMEZONE = "America/Los_Angeles";
const SLOT_DURATION_MIN = 30;
const SLOT_START_HOUR = 9; // 9:00 AM PT
const SLOT_END_HOUR = 17; // last slot must end by 5:00 PM PT

const calendarId = () => process.env.GOOGLE_CALENDAR_ID || "primary";

// ── Slot catalog ─────────────────────────────────────────────────

export type Slot = {
  /** "9:00 AM" — display label, also the externally addressable identifier */
  label: string;
  /** PT clock hours, 24h */
  hour: number;
  /** PT clock minutes */
  minute: number;
};

function formatLabel(h: number, m: number): string {
  const period = h >= 12 ? "PM" : "AM";
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}:${m.toString().padStart(2, "0")} ${period}`;
}

export const ALL_SLOTS: readonly Slot[] = (() => {
  const out: Slot[] = [];
  for (let h = SLOT_START_HOUR; h < SLOT_END_HOUR; h++) {
    for (let m = 0; m < 60; m += SLOT_DURATION_MIN) {
      out.push({ label: formatLabel(h, m), hour: h, minute: m });
    }
  }
  return out;
})();

export function findSlotByLabel(label: string): Slot | undefined {
  return ALL_SLOTS.find((s) => s.label === label);
}

// ── Configuration ────────────────────────────────────────────────

export function isGoogleCalendarConfigured(): boolean {
  return !!(
    process.env.GOOGLE_CALENDAR_CLIENT_ID &&
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET &&
    process.env.GOOGLE_CALENDAR_REFRESH_TOKEN
  );
}

let cachedClient: calendar_v3.Calendar | null = null;
function calendarClient(): calendar_v3.Calendar {
  if (cachedClient) return cachedClient;
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CALENDAR_CLIENT_ID,
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
  );
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN,
  });
  cachedClient = google.calendar({ version: "v3", auth: oauth2Client });
  return cachedClient;
}

// ── Timezone helpers ─────────────────────────────────────────────
// PT is America/Los_Angeles, with DST. We use Intl to compute the
// offset for any given moment so we don't need a tz library.

function ptOffsetMinutes(at: Date): number {
  const tz = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    timeZoneName: "longOffset",
  })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = tz?.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return -480; // PST fallback
  const sign = m[1] === "+" ? 1 : -1;
  const hours = parseInt(m[2], 10);
  const minutes = m[3] ? parseInt(m[3], 10) : 0;
  return sign * (hours * 60 + minutes);
}

/** Combine a YYYY-MM-DD date string (treated as PT) and a PT clock time → UTC Date. */
export function ptDateTimeToUtc(
  isoDate: string,
  hour: number,
  minute: number,
): Date {
  const [y, mo, d] = isoDate.split("-").map(Number);
  const naive = new Date(Date.UTC(y, mo - 1, d, hour, minute));
  const offset = ptOffsetMinutes(naive);
  return new Date(naive.getTime() - offset * 60_000);
}

// ── Availability ─────────────────────────────────────────────────

export async function getAvailability(isoDate: string): Promise<Slot[]> {
  if (!isGoogleCalendarConfigured()) {
    // Fallback when credentials are missing — every slot appears free.
    // This keeps the modal flow usable in dev and pre-launch.
    return [...ALL_SLOTS];
  }

  const dayStartUtc = ptDateTimeToUtc(isoDate, 0, 0);
  const dayEndUtc = ptDateTimeToUtc(isoDate, 23, 59);

  const cal = calendarClient();
  const res = await cal.freebusy.query({
    requestBody: {
      timeMin: dayStartUtc.toISOString(),
      timeMax: dayEndUtc.toISOString(),
      items: [{ id: calendarId() }],
      timeZone: TIMEZONE,
    },
  });

  const busy = (res.data.calendars?.[calendarId()]?.busy ?? [])
    .map((b) => ({
      start: b.start ? new Date(b.start) : null,
      end: b.end ? new Date(b.end) : null,
    }))
    .filter((r): r is { start: Date; end: Date } => !!r.start && !!r.end);

  return ALL_SLOTS.filter((slot) => {
    const slotStart = ptDateTimeToUtc(isoDate, slot.hour, slot.minute);
    const slotEnd = new Date(slotStart.getTime() + SLOT_DURATION_MIN * 60_000);
    return !busy.some((r) => slotStart < r.end && slotEnd > r.start);
  });
}

// ── Event creation ───────────────────────────────────────────────

export type CreateBookingEventInput = {
  isoDate: string;
  slot: Slot;
  summary: string;
  description: string;
  attendeeEmail?: string;
};

export type CreatedBookingEvent = {
  eventId: string;
  htmlLink: string | null;
  meetLink: string | null;
};

export async function createBookingEvent(
  input: CreateBookingEventInput,
): Promise<CreatedBookingEvent> {
  if (!isGoogleCalendarConfigured()) {
    throw new Error(
      "Google Calendar credentials are not configured — cannot create event.",
    );
  }

  const { isoDate, slot } = input;
  const startLocal = `${isoDate}T${pad(slot.hour)}:${pad(slot.minute)}:00`;
  const endTotalMin = slot.hour * 60 + slot.minute + SLOT_DURATION_MIN;
  const endHour = Math.floor(endTotalMin / 60);
  const endMin = endTotalMin % 60;
  const endLocal = `${isoDate}T${pad(endHour)}:${pad(endMin)}:00`;

  const cal = calendarClient();
  const res = await cal.events.insert({
    calendarId: calendarId(),
    // Required for the API to honor conferenceData.createRequest.
    conferenceDataVersion: 1,
    // Email the calendar invite to attendees (defaults to none).
    sendUpdates: "all",
    requestBody: {
      summary: input.summary,
      description: input.description,
      start: { dateTime: startLocal, timeZone: TIMEZONE },
      end: { dateTime: endLocal, timeZone: TIMEZONE },
      attendees: input.attendeeEmail ? [{ email: input.attendeeEmail }] : undefined,
      conferenceData: {
        createRequest: {
          requestId: crypto.randomUUID(),
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    },
  });
  const meetLink =
    res.data.hangoutLink ??
    res.data.conferenceData?.entryPoints?.find(
      (e) => e.entryPointType === "video",
    )?.uri ??
    null;
  return {
    eventId: res.data.id ?? "",
    htmlLink: res.data.htmlLink ?? null,
    meetLink,
  };
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Today's date in Pacific Time as YYYY-MM-DD. */
export function ptToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
