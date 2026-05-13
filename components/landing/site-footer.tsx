export function SiteFooter() {
  return (
    <footer className="bg-forest-deep border-t border-gold/20 px-6 sm:px-10 py-8 text-center">
      <p className="font-heading text-[0.7rem] tracking-[0.12em] uppercase text-moss leading-[2]">
        <span className="text-gold">Peak Studios CO</span> &middot; Legacy Video &middot; Victoria &amp;
        Vancouver, BC, Canada &middot;{" "}
        <span className="text-gold">peaklegacyvideos@gmail.com</span>
      </p>
      <p className="font-heading text-[0.7rem] tracking-[0.12em] uppercase text-moss mt-1">
        © {new Date().getFullYear()} Peak Studios CO. All rights reserved.
      </p>
    </footer>
  );
}
