import { expect, test } from "vitest";
import { renderTemplate } from "@/lib/email/template-render";
import { substituteVariables } from "@/lib/email/variables";
import { tiptapDoc } from "./helpers/fixtures";

const rosie = {
  firstName: "Rosie",
  lastName: "Larsen",
  email: "rosie@example.com",
  packageInterest: "heirloom" as const,
  bookingUrl: "https://peak.example/book",
};

test("variables are substituted in subject, html body, and plain-text alternate", async () => {
  const rendered = renderTemplate({
    subject: "For {{firstName}} {{lastName}}",
    body: tiptapDoc(
      "Hi {{firstName}}, you picked {{packageLabel}}.",
      "Book here: {{bookingUrl}}",
    ),
    lead: rosie,
  });

  expect(rendered.subject).toBe("For Rosie Larsen");
  expect(rendered.html).toContain("Hi Rosie, you picked The Heirloom ($3,500 CAD).");
  expect(rendered.html).toContain("Book here: https://peak.example/book");
  expect(rendered.text).toContain("Hi Rosie, you picked The Heirloom ($3,500 CAD).");
});

test("unknown variables render as their literal {{...}} form so mistakes are visible", () => {
  const rendered = renderTemplate({
    subject: "Hello {{firstNarne}}",
    body: tiptapDoc("Your {{discountCode}} awaits, {{firstName}}."),
    lead: rosie,
  });

  expect(rendered.subject).toBe("Hello {{firstNarne}}");
  expect(rendered.html).toContain("Your {{discountCode}} awaits, Rosie.");
  expect(rendered.text).toContain("Your {{discountCode}} awaits, Rosie.");
});

test("substitution tolerates whitespace inside the braces", () => {
  expect(
    substituteVariables("Hi {{ firstName }}!", { firstName: "Rosie" }),
  ).toBe("Hi Rosie!");
});

test("an unsubscribe footer is appended to html and text only when the lead has an unsubscribe url", () => {
  const withUrl = renderTemplate({
    subject: "s",
    body: tiptapDoc("Inline link: {{unsubscribeUrl}}"),
    lead: { ...rosie, unsubscribeUrl: "https://peak.example/unsubscribe?lead=1&token=2" },
  });
  expect(withUrl.html).toContain("Unsubscribe here");
  expect(withUrl.text).toContain(
    "Unsubscribe: https://peak.example/unsubscribe?lead=1&token=2",
  );
  // The variable is also available inline inside the body.
  expect(withUrl.text).toContain(
    "Inline link: https://peak.example/unsubscribe?lead=1&token=2",
  );

  const withoutUrl = renderTemplate({
    subject: "s",
    body: tiptapDoc("Plain body."),
    lead: rosie,
  });
  expect(withoutUrl.html).not.toContain("Unsubscribe");
  expect(withoutUrl.text).not.toContain("Unsubscribe");
});
