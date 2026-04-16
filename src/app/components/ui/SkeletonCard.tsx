/**
 * Reusable skeleton loading placeholders.
 * Uses the CSS .skeleton class from theme.css for the shimmer animation.
 * Respects prefers-reduced-motion via CSS.
 */

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`skeleton min-h-[160px] ${className}`} />
  );
}

export function SkeletonRow({ className = "" }: { className?: string }) {
  return (
    <div className={`skeleton h-16 w-full ${className}`} />
  );
}

export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton h-4"
          style={{ width: i === lines - 1 ? "60%" : "100%" }}
        />
      ))}
    </div>
  );
}

export function SkeletonGrid({ count = 6, className = "" }: { count?: number; className?: string }) {
  return (
    <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
