import { z } from "zod";

export const packageInterestSchema = z.enum(["legacy", "heirloom", "unsure"]);
export type PackageInterest = z.infer<typeof packageInterestSchema>;

export const leadFormSchema = z.object({
  firstName: z.string().trim().min(1, "Please enter your first name."),
  lastName: z.string().trim().min(1, "Please enter your last name."),
  email: z.email("Please enter a valid email address."),
  phone: z.string().trim().optional(),
  packageInterest: packageInterestSchema,
  notes: z.string().trim().optional(),
});

export type LeadFormValues = z.infer<typeof leadFormSchema>;

export const PACKAGE_OPTIONS: { value: PackageInterest; label: string }[] = [
  { value: "unsure", label: "Not sure yet" },
  { value: "legacy", label: "The Legacy — $2,500 CAD" },
  { value: "heirloom", label: "The Heirloom — $3,500 CAD" },
];
