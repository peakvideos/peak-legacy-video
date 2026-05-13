import { cn } from "@/lib/utils";

export function ProgressDots({ current }: { current: 1 | 2 | 3 | "confirm" }) {
  const step = current === "confirm" ? 3 : current;
  return (
    <div className="flex gap-2 mb-7" aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className={cn(
            "h-1 flex-1 transition-colors",
            i <= step ? "bg-gold" : "bg-forest/12",
          )}
        />
      ))}
    </div>
  );
}
