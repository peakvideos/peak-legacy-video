import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Reveal } from "./reveal";

const FAQS = [
  {
    q: "Where do you film?",
    a: "We come to you — your loved one's home, a family member's home, or another comfortable location of your choosing in the Victoria or Vancouver area.",
  },
  {
    q: "How long does the session take?",
    a: "The interview itself is typically 60–90 minutes. We arrive early to set up and stay a little after to pack down — the whole visit is usually around 2–3 hours.",
  },
  {
    q: "What if my loved one is nervous or shy?",
    a: "This is very common, and it's something we're experienced with. Our interviewers are warm, patient, and skilled at putting people at ease. Most subjects forget the cameras are there within the first few minutes.",
  },
  {
    q: "How long until we receive the film?",
    a: "You'll receive your completed legacy film within 3–4 weeks of your session.",
  },
  {
    q: "Can we add more people to the interview?",
    a: "The session is designed around one primary subject, but we can discuss accommodating a couple or adding a short segment with a family member. Just ask us.",
  },
  {
    q: "Do you travel outside Victoria and Vancouver?",
    a: "We occasionally travel for sessions. Reach out and we can discuss options.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="bg-off-white px-6 sm:px-10 py-24">
      <div className="max-w-[720px] mx-auto">
        <Reveal as="h2" className="text-forest text-center mb-2 text-[clamp(1.6rem,3.5vw,2.5rem)]">
          Common questions
        </Reveal>
        <Reveal as="p" className="text-tofino text-center italic mb-12">
          Everything you need to know before booking.
        </Reveal>

        <Reveal>
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((item, i) => (
              <AccordionItem key={item.q} value={`item-${i}`}>
                <AccordionTrigger className="font-heading text-base text-forest hover:text-gold hover:no-underline py-5">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-foreground/70 leading-[1.75] text-base pb-5">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
