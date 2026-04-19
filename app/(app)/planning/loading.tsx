export default function PlanningLoading() {
  return (
    <div className="flex flex-col gap-3 px-4 pt-4 pb-8 animate-pulse">
      <div className="h-8 bg-slate-100 rounded-xl w-28 mb-1" />
      <div className="h-11 bg-slate-100 rounded-xl" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-20 bg-slate-100 rounded-2xl" />
      ))}
    </div>
  );
}
