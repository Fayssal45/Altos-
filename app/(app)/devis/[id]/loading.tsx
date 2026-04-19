export default function DevisDetailLoading() {
  return (
    <div className="flex flex-col gap-3 px-4 pt-4 pb-8 animate-pulse">
      <div className="h-8 bg-slate-100 rounded-xl w-40 mb-1" />
      <div className="h-20 bg-slate-100 rounded-2xl" />
      <div className="h-32 bg-slate-100 rounded-2xl" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-14 bg-slate-100 rounded-2xl" />
      ))}
      <div className="h-24 bg-slate-100 rounded-2xl" />
    </div>
  );
}
