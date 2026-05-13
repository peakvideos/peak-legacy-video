import { Reveal } from "./reveal";

const STEPS = [
  {
    num: "Step 01",
    title: "Book Your Session",
    body:
      "Choose your package and reserve a date. We keep our calendar intentionally small so every family gets our full attention.",
  },
  {
    num: "Step 02",
    title: "We Come to You",
    body:
      "Our team arrives with a professional two-camera setup. We take care of everything — your loved one just needs to be themselves.",
  },
  {
    num: "Step 03",
    title: "The Interview",
    body:
      "Using our thoughtfully crafted questions, we gently guide your loved one through their whole life story — from childhood memories to the wisdom they want to pass on.",
  },
  {
    num: "Step 04",
    title: "We Craft Your Film",
    body:
      "We edit the footage into a beautiful, chapter-structured legacy film. Every detail is handled with respect and care.",
  },
  {
    num: "Step 05",
    title: "Yours Forever",
    body:
      "Your film is delivered digitally, ready to share with family near and far — and with The Heirloom package, preserved on a premium USB keepsake as well.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="bg-forest px-6 sm:px-10 py-24">
      <div className="max-w-[960px] mx-auto">
        <Reveal as="h2" className="text-white text-center mb-2 text-[clamp(1.6rem,3.5vw,2.5rem)]">
          Simple, thoughtful, and handled with care.
        </Reveal>
        <Reveal as="p" className="text-moss text-center italic mb-14">
          Here&apos;s what the experience looks like, start to finish.
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {STEPS.map((s) => (
            <Reveal
              key={s.num}
              className="border-l-2 border-gold bg-white/4 px-6 py-5 transition-colors hover:bg-white/7"
            >
              <p className="font-heading text-[0.68rem] tracking-[0.22em] uppercase text-gold mb-2">
                {s.num}
              </p>
              <h3 className="font-heading text-white mb-2 text-base sm:text-lg">{s.title}</h3>
              <p className="text-sky text-sm leading-[1.7]">{s.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
