export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="skeleton h-56 rounded-[1.75rem]" />
      <div className="skeleton mt-6 h-40 rounded-2xl" />
      <span className="sr-only">Fetching your ticket…</span>
    </div>
  );
}
