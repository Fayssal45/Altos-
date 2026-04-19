// Root app loading skeleton – shown on any (app) route transition
export default function AppLoading() {
  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-8 animate-pulse">
      {/* Top bar placeholder */}
      <div className="h-11 bg-slate-100 rounded-2xl w-full" />
      {/* Card */}
      <div className="h-28 bg-slate-100 rounded-2xl w-full" />
      {/* Grid */}
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 bg-slate-100 rounded-2xl" />
        ))}
      </div>
      {/* List rows */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-16 bg-slate-100 rounded-2xl w-full" />
      ))}
    </div>
  );
}
