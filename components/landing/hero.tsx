import { BookingTrigger } from "@/components/booking/booking-trigger";
import { Reveal } from "./reveal";

export function Hero() {
  return (
    <section
      id="hero"
      className="relative min-h-screen overflow-hidden bg-forest-deep px-6 sm:px-10 pt-24 pb-20 flex flex-col justify-center"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 72% 40%, rgba(147,168,136,0.13) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 18% 82%, rgba(206,166,74,0.08) 0%, transparent 50%)",
        }}
      />

      <div className="relative z-10 max-w-[780px]">
        <Reveal>
          <div className="font-heading text-xs tracking-[0.22em] uppercase text-gold mb-6 flex items-center gap-3">
            <span className="block w-[30px] h-px bg-gold" />
            Peak Studios CO &middot; Legacy Video
          </div>
        </Reveal>

        <Reveal delay={150}>
          <h1 className="text-white mb-6 leading-[1.1] text-[clamp(2.2rem,5.5vw,4rem)]">
            Their stories deserve
            <br />
            to live <em className="not-italic text-gold">forever.</em>
          </h1>
        </Reveal>

        <Reveal delay={300}>
          <p className="text-sky max-w-[560px] mb-10 text-[clamp(1rem,1.8vw,1.18rem)] leading-[1.82]">
            Peak Studios CO creates beautiful, professional legacy films — capturing your loved one&apos;s
            life story in their own words, to be treasured by your family for generations.
          </p>
        </Reveal>

        <Reveal delay={450}>
          <div className="flex flex-wrap items-center gap-4">
            <BookingTrigger styleVariant="primary">Reserve Your Time Today</BookingTrigger>
            <BookingTrigger styleVariant="ghost" bookingVariant="questions">
              Have questions? We&apos;d love to chat.
            </BookingTrigger>
          </div>
        </Reveal>

        <Reveal delay={600}>
          <p className="mt-12 font-heading text-[0.72rem] tracking-[0.16em] uppercase text-moss">
            Serving Victoria &amp; Vancouver, BC &middot; Limited sessions available each month
          </p>
        </Reveal>
      </div>
    </section>
  );
}
