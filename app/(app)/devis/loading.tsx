export default function DevisLoading() {
  return (
    <div className="flex flex-col gap-3 px-4 pt-4 pb-8 animate-pulse">
      <div className="flex items-center justify-between mb-1">
        <div className="h-8 bg-slate-100 rounded-xl w-24" />
        <div className="h-9 w-9 bg-slate-100 rounded-xl" />
      </div>
      <div className="h-11 bg-slate-100 rounded-xl" />
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-20 flex-shrink-0 bg-slate-100 rounded-xl" />
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-24 bg-slate-100 rounded-2xl" />
      ))}
    </div>
  );
}
