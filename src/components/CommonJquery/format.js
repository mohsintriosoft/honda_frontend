/* format.js
   ---------
   Display helpers for the intelligence dashboard.

   Unchanged from the previous version apart from dropping the active-target
   helpers, which have no meaning now that there is one dashboard per account. */

/** 12400 -> "12.4K". Returns an em dash for null so a metric that was never
 *  measured stays visibly different from a real zero. */
export const compact = (n) => {
  if (n === null || n === undefined) return "—";
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
};

/** ISO date -> "04 Aug 2026" */
export const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

/** ISO date -> "3 days ago" */
export const relativeTime = (iso) => {
  if (!iso) return "never";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.round(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)} hours ago`;
  return `${Math.round(diff / 86400)} days ago`;
};

/** 4 -> "★★★★☆" */
export const stars = (n) =>
  "★".repeat(n || 0) + "☆".repeat(Math.max(5 - (n || 0), 0));

/** Signed percentage-point value: 4.2 -> "+4.2" */
export const signed = (n) => {
  if (n === null || n === undefined) return "—";
  return `${n > 0 ? "+" : ""}${n}`;
};

/** Reads a live CSS custom property, so charts follow dark mode instead of
 *  carrying a second hardcoded palette. */
export const cssVar = (name, fallback) => {
  if (typeof window === "undefined") return fallback;
  return (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    fallback
  );
};
