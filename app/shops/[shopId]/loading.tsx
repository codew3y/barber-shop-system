export default function Loading() {
  return (
    <div>
      <div className="skeleton h-72 rounded-[1.75rem]" />
      <div className="mt-10 grid gap-10 sm:grid-cols-2">
        <div className="skeleton h-64 rounded-2xl" />
        <div className="skeleton h-64 rounded-2xl" />
      </div>
      <span className="sr-only">Opening the shop…</span>
    </div>
  );
}
