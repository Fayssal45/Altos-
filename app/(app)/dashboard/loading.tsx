export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-8 animate-pulse">
      {/* Date banner */}
      <div className="h-10 bg-slate-100 rounded-xl w-56" />
      {/* CTA card */}
      <div className="h-20 bg-amber-100 rounded-2xl" />
      {/* Today */}
      <div className="h-5 bg-slate-100 rounded-lg w-24" />
      <div className="h-24 bg-slate-100 rounded-2xl" />
      {/* Nav grid */}
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 bg-slate-100 rounded-2xl" />
        ))}
      </div>
      {/* Metrics */}
      <div className="h-32 bg-slate-100 rounded-2xl" />
      {/* Activity */}
      <div className="h-5 bg-slate-100 rounded-lg w-32" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-16 bg-slate-100 rounded-xl" />
      ))}
    </div>
  );
}
