/**
 * Variables available inside email templates. Author writes `{{variableName}}`
 * in subject or body; renderer substitutes at send time.
 *
 * Shared between the Tiptap editor (variable picker UI) and the server-side
 * renderer. Pure data — safe to import from client or server code.
 */

export type VariableName =
  | "firstName"
  | "lastName"
  | "email"
  | "bookingUrl"
  | "packageLabel"
  | "unsubscribeUrl";

export type VariableDescriptor = {
  name: VariableName;
  label: string;
  description: string;
};

export const TEMPLATE_VARIABLES: VariableDescriptor[] = [
  {
    name: "firstName",
    label: "First name",
    description: "The lead's first name.",
  },
  {
    name: "lastName",
    label: "Last name",
    description: "The lead's last name.",
  },
  {
    name: "email",
    label: "Email",
    description: "The lead's email address.",
  },
  {
    name: "bookingUrl",
    label: "Booking URL",
    description: "Link back to the landing page so the lead can book a call.",
  },
  {
    name: "packageLabel",
    label: "Package interest",
    description: "Human label for the package the lead picked (or \"Not sure yet\").",
  },
  {
    name: "unsubscribeUrl",
    label: "Unsubscribe URL",
    description: "Per-lead unsubscribe link. Also auto-appended as a footer.",
  },
];

export const VARIABLE_NAMES: VariableName[] = TEMPLATE_VARIABLES.map(
  (v) => v.name,
);

const VARIABLE_NAME_SET = new Set<string>(VARIABLE_NAMES);

export function isKnownVariable(name: string): name is VariableName {
  return VARIABLE_NAME_SET.has(name);
}

const PACKAGE_LABELS = {
  legacy: "The Legacy ($2,500 CAD)",
  heirloom: "The Heirloom ($3,500 CAD)",
  unsure: "Not sure yet",
} as const;

export type LeadVariableInput = {
  firstName: string;
  lastName: string;
  email: string;
  packageInterest: keyof typeof PACKAGE_LABELS;
  bookingUrl: string;
  unsubscribeUrl?: string;
};

export function buildVariableMap(
  input: LeadVariableInput,
): Record<VariableName, string> {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    bookingUrl: input.bookingUrl,
    packageLabel: PACKAGE_LABELS[input.packageInterest],
    unsubscribeUrl: input.unsubscribeUrl ?? "",
  };
}

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;

/**
 * Replaces every `{{variable}}` occurrence in `input` with its resolved
 * value. Unknown variables are left as their literal `{{...}}` form so the
 * recipient sees something obvious is wrong (per spec).
 */
export function substituteVariables(
  input: string,
  values: Partial<Record<VariableName, string>>,
): string {
  return input.replace(VARIABLE_PATTERN, (match, name: string) => {
    if (isKnownVariable(name) && values[name] != null) {
      return values[name] as string;
    }
    return match;
  });
}

export type VariableValidationIssue =
  | { kind: "unknown"; name: string }
  | { kind: "stray-brace"; brace: "{" | "}" };

/**
 * Lints a string of plain text for `{{variable}}` references. Used by the
 * editor to warn the author about typos before they save.
 *
 * Returns one issue per unique problem; callers can dedupe further.
 */
export function lintVariablesInText(text: string): VariableValidationIssue[] {
  const issues: VariableValidationIssue[] = [];
  const seenUnknown = new Set<string>();

  // Strip well-formed `{{name}}` matches first so stray-brace detection
  // doesn't double-report on legitimate variable syntax.
  const stripped = text.replace(VARIABLE_PATTERN, (_match, name: string) => {
    if (!isKnownVariable(name) && !seenUnknown.has(name)) {
      seenUnknown.add(name);
      issues.push({ kind: "unknown", name });
    }
    return "";
  });

  if (/\{/.test(stripped)) {
    issues.push({ kind: "stray-brace", brace: "{" });
  }
  if (/\}/.test(stripped)) {
    issues.push({ kind: "stray-brace", brace: "}" });
  }

  return issues;
}
