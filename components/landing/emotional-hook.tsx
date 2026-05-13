import { Reveal } from "./reveal";

export function EmotionalHook() {
  return (
    <section id="hook" className="bg-off-white px-6 sm:px-10 py-24">
      <div className="max-w-[700px] mx-auto text-center">
        <Reveal as="h2" className="text-forest mb-7 text-[clamp(1.6rem,3.5vw,2.5rem)] leading-[1.2]">
          One day, you won&apos;t be able to ask them anymore.
        </Reveal>
        <Reveal as="p" className="text-foreground/70 mb-5 leading-[1.78]">
          There are stories inside your grandparents — about the life they lived before you were born, the
          hardships they overcame, the love that carried them through. Stories they&apos;ve never fully
          told. And one day, quietly, those stories will be gone.
        </Reveal>
        <Reveal as="p" className="text-foreground/70 mb-5 leading-[1.78]">
          Peak Studios CO exists for one reason: to make sure that doesn&apos;t happen.
        </Reveal>
        <Reveal as="p" className="text-foreground/70 mb-5 leading-[1.78]">
          We come to your family with a professional two-camera setup, a warm and unhurried interview style,
          and questions designed to draw out the whole story — the funny moments, the hard ones, the ones
          that shaped who they are. Then we craft it all into a beautiful film your family will return to
          again and again.
        </Reveal>
        <Reveal as="p" className="text-forest text-[1.18rem] italic mt-2">
          This is not a home video. This is a legacy.
        </Reveal>
      </div>
    </section>
  );
}
