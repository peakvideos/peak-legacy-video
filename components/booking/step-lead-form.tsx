"use client";

import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  leadFormSchema,
  PACKAGE_OPTIONS,
  type LeadFormValues,
  type PackageInterest,
} from "./schemas";

type Props = {
  initialValues?: Partial<LeadFormValues>;
  initialPackage?: PackageInterest;
  formId: string;
  onComplete: (values: LeadFormValues) => void;
};

export function StepLeadForm({
  initialValues,
  initialPackage,
  formId,
  onComplete,
}: Props) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LeadFormValues>({
    resolver: standardSchemaResolver(leadFormSchema),
    defaultValues: {
      firstName: initialValues?.firstName ?? "",
      lastName: initialValues?.lastName ?? "",
      email: initialValues?.email ?? "",
      phone: initialValues?.phone ?? "",
      packageInterest:
        initialValues?.packageInterest ?? initialPackage ?? "unsure",
      notes: initialValues?.notes ?? "",
    },
  });

  const selectedPackage = watch("packageInterest");

  return (
    <form
      id={formId}
      onSubmit={handleSubmit(onComplete)}
      className="space-y-4"
      noValidate
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="firstName" className="font-heading text-xs uppercase tracking-[0.12em] text-forest">
            First Name <span className="text-gold">*</span>
          </Label>
          <Input
            id="firstName"
            placeholder="Jane"
            autoComplete="given-name"
            aria-invalid={!!errors.firstName}
            {...register("firstName")}
          />
          {errors.firstName && (
            <p className="text-xs text-destructive">{errors.firstName.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lastName" className="font-heading text-xs uppercase tracking-[0.12em] text-forest">
            Last Name <span className="text-gold">*</span>
          </Label>
          <Input
            id="lastName"
            placeholder="Smith"
            autoComplete="family-name"
            aria-invalid={!!errors.lastName}
            {...register("lastName")}
          />
          {errors.lastName && (
            <p className="text-xs text-destructive">{errors.lastName.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email" className="font-heading text-xs uppercase tracking-[0.12em] text-forest">
          Email Address <span className="text-gold">*</span>
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="jane@example.com"
          autoComplete="email"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone" className="font-heading text-xs uppercase tracking-[0.12em] text-forest">
          Phone Number
        </Label>
        <Input
          id="phone"
          type="tel"
          placeholder="+1 (250) 000-0000"
          autoComplete="tel"
          {...register("phone")}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="packageInterest" className="font-heading text-xs uppercase tracking-[0.12em] text-forest">
          Which package interests you?
        </Label>
        <Select
          value={selectedPackage}
          onValueChange={(v) => setValue("packageInterest", v as PackageInterest, { shouldDirty: true })}
        >
          <SelectTrigger id="packageInterest" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PACKAGE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes" className="font-heading text-xs uppercase tracking-[0.12em] text-forest">
          Anything you&apos;d like us to know?
        </Label>
        <Textarea
          id="notes"
          placeholder="Tell us a little about who we'll be filming, or any questions you have…"
          rows={3}
          {...register("notes")}
        />
      </div>
    </form>
  );
}
