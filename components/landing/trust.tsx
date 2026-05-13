import { BookingTrigger } from "@/components/booking/booking-trigger";
import { Reveal } from "./reveal";

export function Trust() {
  return (
    <section id="trust" className="bg-off-white px-6 sm:px-10 py-24">
      <div className="max-w-[580px] mx-auto text-center">
        <Reveal as="h2" className="text-forest mb-5 text-[clamp(1.6rem,3.5vw,2.5rem)]">
          There&apos;s never a wrong time to start.
        </Reveal>
        <Reveal as="p" className="text-foreground/70 mb-9 text-[1.08rem] leading-[1.78]">
          Whenever you&apos;re ready, we&apos;re here. Whether you&apos;re planning ahead or feeling a quiet
          nudge to do this soon, we&apos;re happy to answer questions and walk you through the process — no
          rush, no pressure.
        </Reveal>
        <Reveal>
          <BookingTrigger styleVariant="outline" bookingVariant="questions">
            Get in Touch
          </BookingTrigger>
        </Reveal>
      </div>
    </section>
  );
}
