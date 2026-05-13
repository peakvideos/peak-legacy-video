import { BookingTrigger } from "@/components/booking/booking-trigger";
import { Reveal } from "./reveal";

export function FooterCta() {
  return (
    <section
      id="footer-cta"
      className="relative overflow-hidden bg-forest px-6 sm:px-10 py-24 text-center"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(206,166,74,0.09) 0%, transparent 60%)",
        }}
      />
      <div className="relative z-10 max-w-[620px] mx-auto">
        <Reveal as="h2" className="text-white mb-5 text-[clamp(1.6rem,3.5vw,2.5rem)]">
          Their memories belong to your whole family — for generations to come.
        </Reveal>
        <Reveal as="p" className="text-sky mb-10 text-[1.08rem] leading-[1.8]">
          We&apos;d love to help your family capture one of them. Reserve your session today and we&apos;ll
          take care of everything else.
        </Reveal>
        <Reveal className="flex flex-col items-center gap-5">
          <BookingTrigger styleVariant="primary">Reserve Your Time Today</BookingTrigger>
          <BookingTrigger
            styleVariant="ghost"
            bookingVariant="questions"
            className="text-moss border-transparent hover:text-gold hover:border-gold"
          >
            Have questions? We&apos;d love to chat.
          </BookingTrigger>
        </Reveal>
      </div>
    </section>
  );
}
