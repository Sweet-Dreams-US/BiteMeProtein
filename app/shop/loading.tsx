/**
 * /shop loading skeleton — prevents blank screen while the catalog fetches.
 */
export default function ShopLoading() {
  return (
    <div className="min-h-screen bg-cream py-16">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="h-4 w-24 bg-[#f0e6de] rounded mx-auto mb-4 animate-pulse" />
          <div className="h-12 w-2/3 max-w-md bg-[#f0e6de] rounded mx-auto animate-pulse" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-[#f0e6de] overflow-hidden">
              <div className="aspect-square bg-[#FFF5EE] animate-pulse" />
              <div className="p-5 space-y-3">
                <div className="h-5 w-3/4 bg-[#f0e6de] rounded animate-pulse" />
                <div className="h-4 w-full bg-[#f0e6de] rounded animate-pulse" />
                <div className="h-4 w-1/2 bg-[#f0e6de] rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
