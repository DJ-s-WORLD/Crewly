/**
 * Human-readable completion label using the viewer's local calendar.
 * Today → "Completed yesterday" → locale date (e.g. 10/04/2026 in en-GB).
 */
export function formatTaskCompletionDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const completed = new Date(iso);
  if (Number.isNaN(completed.getTime())) return "";

  const now = new Date();
  const startOfLocalDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round(
    (startOfLocalDay(now).getTime() - startOfLocalDay(completed).getTime()) / 86_400_000
  );

  if (diffDays === 0) return "Completed today";
  if (diffDays === 1) return "Completed yesterday";

  return completed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
