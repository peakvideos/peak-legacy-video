import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-forest-deep px-6 text-center">
      <div className="max-w-md">
        <p className="font-heading text-xs uppercase tracking-[0.22em] text-gold mb-3">
          Peak Studios CO
        </p>
        <h1 className="text-white text-4xl mb-3">Page not found.</h1>
        <p className="text-sky italic mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
        <Link
          href="/"
          className="inline-block bg-gold text-forest font-heading text-sm tracking-[0.1em] uppercase px-7 py-3 transition hover:bg-gold-light"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
