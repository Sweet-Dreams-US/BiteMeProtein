/**
 * Default loading UI — shown by Next.js while a server route is streaming.
 * Keep it simple and minimal: a friendly spinner, no layout shift.
 */
export default function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6 py-20 bg-cream">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-3 border-[#E8A0BF] border-t-transparent rounded-full animate-spin" />
        <p className="text-dark/50 text-sm">Baking the page…</p>
      </div>
    </div>
  );
}
