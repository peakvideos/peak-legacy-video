import { Button } from "@/components/ui/button";

const swatches = [
  { name: "forest", className: "bg-forest text-off-white" },
  { name: "forest-deep", className: "bg-forest-deep text-off-white" },
  { name: "gold", className: "bg-gold text-forest" },
  { name: "gold-light", className: "bg-gold-light text-forest" },
  { name: "moss", className: "bg-moss text-forest" },
  { name: "blush", className: "bg-blush text-forest" },
  { name: "tofino", className: "bg-tofino text-off-white" },
  { name: "sky", className: "bg-sky text-forest" },
  { name: "sky-light", className: "bg-sky-light text-forest" },
  { name: "off-white", className: "bg-off-white text-forest border" },
];

export const metadata = {
  title: "Style guide — Peak Studios CO",
  robots: { index: false, follow: false },
};

export default function StyleGuide() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-16">
      <p className="text-xs uppercase tracking-[0.22em] text-gold mb-4">
        Internal · Style Guide
      </p>
      <h1 className="text-5xl text-forest mb-3">
        Their stories deserve to live <em className="not-italic text-gold">forever.</em>
      </h1>
      <p className="text-lg text-tofino italic mb-12">
        Reference page for fonts, brand tokens, and shadcn primitives. Not linked from the landing page.
      </p>

      <section className="mb-12">
        <h2 className="text-2xl text-forest mb-4">Typography</h2>
        <div className="space-y-2">
          <p className="font-heading text-3xl text-forest">Alata — headings</p>
          <p className="font-sans text-lg text-forest">
            Cardo — body copy. The interview itself is typically 60–90 minutes.
          </p>
          <p className="font-sans italic text-lg text-tofino">
            Cardo italic — pull quotes and supporting notes.
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl text-forest mb-4">Brand palette</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {swatches.map((s) => (
            <div
              key={s.name}
              className={`${s.className} aspect-square flex items-center justify-center text-xs font-heading uppercase tracking-widest`}
            >
              {s.name}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl text-forest mb-4">Buttons (shadcn)</h2>
        <div className="flex flex-wrap gap-3">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
        </div>
      </section>
    </main>
  );
}
