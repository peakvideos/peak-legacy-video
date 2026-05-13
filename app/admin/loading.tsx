export default function AdminLoading() {
  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="px-6 py-3 border-b border-(--adm-border) bg-(--adm-surface)">
        <div className="h-5 w-40 bg-(--adm-text-muted)/15 animate-pulse" />
        <div className="h-3 w-56 bg-(--adm-text-muted)/10 animate-pulse mt-1.5" />
      </div>
      <div className="flex-1 overflow-hidden">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="grid grid-cols-[80px_1fr_auto] gap-4 px-6 py-3 border-b border-(--adm-border) items-start"
          >
            <div className="h-4 w-16 bg-(--adm-text-muted)/15 animate-pulse" />
            <div>
              <div className="h-3 w-32 bg-(--adm-text-muted)/15 animate-pulse mb-2" />
              <div className="h-4 w-64 bg-(--adm-text-muted)/15 animate-pulse mb-1" />
              <div className="h-3 w-80 bg-(--adm-text-muted)/10 animate-pulse" />
            </div>
            <div className="h-7 w-14 bg-(--adm-text-muted)/15 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
