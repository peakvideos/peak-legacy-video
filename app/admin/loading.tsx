export default function AdminLoading() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-10">
      <div>
        <div className="h-9 w-64 bg-forest/8 animate-pulse" />
        <div className="h-4 w-48 bg-forest/6 animate-pulse mt-2" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-white border-l-2 border-gold p-5">
            <div className="h-3 w-24 bg-forest/8 animate-pulse mb-3" />
            <div className="h-9 w-16 bg-forest/8 animate-pulse" />
          </div>
        ))}
      </div>
      <div className="bg-white border border-forest/10 p-8">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex items-center gap-4 py-3 border-b last:border-b-0 border-forest/8"
          >
            <div className="h-4 w-32 bg-forest/8 animate-pulse" />
            <div className="h-4 w-48 bg-forest/8 animate-pulse" />
            <div className="h-4 w-24 bg-forest/8 animate-pulse ml-auto" />
          </div>
        ))}
      </div>
    </main>
  );
}
