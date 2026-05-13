import { BookingTrigger } from "@/components/booking/booking-trigger";
import { Reveal } from "./reveal";

const LEGACY_FEATURES = [
  "Professional 2-camera interview setup",
  "Thoughtfully crafted life-story questions",
  "Full interview session (approx. 60–90 min)",
  "Edited legacy film (20–30 minutes)",
  "Chapter titles and structure",
  "Digital delivery — easy to download and share",
];

const HEIRLOOM_FEATURES = [
  "Photo & memorabilia integration — old photos and letters woven into the film",
  "Extended edit (40–60 minutes)",
  "3–5 min shareable highlight reel",
  "Premium USB keepsake — beautifully packaged",
];

function FeatureList({ items, tone }: { items: string[]; tone: "dark" | "light" }) {
  return (
    <ul className="space-y-3 mb-8">
      {items.map((item) => (
        <li
          key={item}
          className={`flex items-start gap-3 text-sm leading-[1.5] ${tone === "dark" ? "text-sky" : "text-foreground/70"}`}
        >
          <span className="text-gold font-heading shrink-0">—</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function Packages() {
  return (
    <section id="packages" className="bg-sky-light px-6 sm:px-10 py-24">
      <div className="max-w-[960px] mx-auto">
        <Reveal as="h2" className="text-forest text-center mb-2 text-[clamp(1.6rem,3.5vw,2.5rem)]">
          Choose the legacy that fits your family.
        </Reveal>
        <Reveal as="p" className="text-tofino text-center italic mb-14">
          Two packages. Both crafted with the same care.
        </Reveal>

        <div className="grid sm:grid-cols-2 gap-8">
          <Reveal className="bg-white border border-forest/10 p-9 transition-all hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(35,52,21,0.14)]">
            <p className="font-heading text-[0.78rem] tracking-[0.2em] uppercase text-forest mb-2">
              The Legacy
            </p>
            <p className="font-heading text-forest text-[2.3rem] mb-1">
              <span className="text-base align-super mr-0.5">$</span>2,500{" "}
              <span className="font-sans text-sm italic text-tofino">CAD</span>
            </p>
            <div className="h-px bg-forest/10 my-5" />
            <FeatureList items={LEGACY_FEATURES} tone="light" />
            <BookingTrigger
              styleVariant="package-dark"
              packageInterest="legacy"
            >
              Book The Legacy
            </BookingTrigger>
          </Reveal>

          <Reveal
            delay={120}
            className="relative bg-forest border-2 border-gold p-9 transition-all hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(35,52,21,0.14)]"
          >
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold text-forest font-heading text-[0.68rem] tracking-[0.12em] uppercase px-4 py-1 whitespace-nowrap">
              Most Popular
            </span>
            <p className="font-heading text-[0.78rem] tracking-[0.2em] uppercase text-gold mb-2">
              The Heirloom
            </p>
            <p className="font-heading text-white text-[2.3rem] mb-1">
              <span className="text-base align-super mr-0.5">$</span>3,500{" "}
              <span className="font-sans text-sm italic text-moss">CAD</span>
            </p>
            <div className="h-px bg-gold/30 my-5" />
            <p className="font-heading text-[0.7rem] tracking-[0.12em] uppercase text-gold mb-3">
              Everything in The Legacy, plus:
            </p>
            <FeatureList items={HEIRLOOM_FEATURES} tone="dark" />
            <BookingTrigger
              styleVariant="package-gold"
              packageInterest="heirloom"
            >
              Book The Heirloom
            </BookingTrigger>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
