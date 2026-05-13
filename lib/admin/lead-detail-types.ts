import type { InferSelectModel } from "drizzle-orm";
import type { bookings, emailJobs, leads } from "@/lib/db/schema";

export type LeadRow = InferSelectModel<typeof leads>;
export type BookingRow = InferSelectModel<typeof bookings>;
export type EmailJobRow = InferSelectModel<typeof emailJobs>;

export type EmailJobWithTemplate = EmailJobRow & {
  templateName: string;
  templateSubject: string;
  templateSlug: string;
};

export type LeadDetail = {
  lead: LeadRow;
  bookings: BookingRow[];
  emailJobs: EmailJobWithTemplate[];
  nextEmailJob: EmailJobWithTemplate | null;
  upcomingBooking: BookingRow | null;
};
