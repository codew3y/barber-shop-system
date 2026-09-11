export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="skeleton h-4 w-24" />
      <div className="skeleton mt-4 h-12 w-56" />
      <div className="mt-10 grid gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-24 rounded-2xl" />
        ))}
      </div>
      <span className="sr-only">Fetching your chairs…</span>
    </div>
  );
}
