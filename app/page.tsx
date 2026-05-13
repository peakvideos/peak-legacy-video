import { Hero } from "@/components/landing/hero";
import { EmotionalHook } from "@/components/landing/emotional-hook";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Packages } from "@/components/landing/packages";
import { Trust } from "@/components/landing/trust";
import { About } from "@/components/landing/about";
import { Faq } from "@/components/landing/faq";
import { FooterCta } from "@/components/landing/footer-cta";
import { SiteFooter } from "@/components/landing/site-footer";
import { GoldDivider } from "@/components/landing/gold-divider";

export default function Home() {
  return (
    <>
      <Hero />
      <GoldDivider />
      <EmotionalHook />
      <GoldDivider />
      <HowItWorks />
      <GoldDivider />
      <Packages />
      <GoldDivider />
      <Trust />
      <GoldDivider />
      <About />
      <GoldDivider />
      <Faq />
      <FooterCta />
      <SiteFooter />
    </>
  );
}
