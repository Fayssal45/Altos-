export default function ClientsLoading() {
  return (
    <div className="flex flex-col gap-3 px-4 pt-4 pb-8 animate-pulse">
      <div className="h-8 bg-slate-100 rounded-xl w-24 mb-1" />
      <div className="h-11 bg-slate-100 rounded-xl" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-16 bg-slate-100 rounded-2xl" />
      ))}
    </div>
  );
}
