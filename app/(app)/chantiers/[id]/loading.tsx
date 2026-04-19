export default function ChantierDetailLoading() {
  return (
    <div className="flex flex-col gap-3 px-4 pt-4 pb-8 animate-pulse">
      <div className="h-8 bg-slate-100 rounded-xl w-36 mb-1" />
      <div className="h-16 bg-slate-100 rounded-2xl" />
      <div className="h-28 bg-slate-100 rounded-2xl" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-14 bg-slate-100 rounded-2xl" />
      ))}
    </div>
  );
}
