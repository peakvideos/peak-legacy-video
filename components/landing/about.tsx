import { Reveal } from "./reveal";

export function About() {
  return (
    <section id="about" className="relative overflow-hidden bg-forest-deep px-6 sm:px-10 py-24">
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 80% at 90% 50%, rgba(147,168,136,0.08) 0%, transparent 60%)",
        }}
      />
      <div className="relative z-10 max-w-[680px]">
        <Reveal>
          <div className="font-heading text-xs tracking-[0.22em] uppercase text-gold mb-6 flex items-center gap-3">
            <span className="block w-[30px] h-px bg-gold" />
            About Peak Studios CO
          </div>
        </Reveal>
        <Reveal as="h2" className="text-white mb-6 text-[clamp(1.6rem,3.5vw,2.5rem)]">
          We believe every life is worth preserving.
        </Reveal>
        <Reveal as="p" className="text-sky mb-5 leading-[1.85]">
          At Peak Studios CO, we&apos;ve spent years telling stories through the lens — and we know better
          than most how powerful a well-crafted film can be. Legacy video is a natural extension of that
          belief: that the most important stories aren&apos;t always the loudest ones, and that the people
          we love most deserve to have their story told with the same care and craft we bring to everything
          we do.
        </Reveal>
        <Reveal as="p" className="text-sky leading-[1.85]">
          We are based in Victoria and Vancouver, BC, and we approach every legacy session with
          professionalism, patience, and genuine heart. For us, this is some of the most meaningful work we
          do.
        </Reveal>
      </div>
    </section>
  );
}
