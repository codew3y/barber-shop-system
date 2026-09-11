// Painted the instant the user taps "Book your chair". Without a loading
// file, Next blocks the whole navigation on the server component's database
// round-trip and renders nothing — which reads as an unresponsive button.
export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="skeleton h-4 w-40" />
      <div className="skeleton mt-4 h-12 w-80 max-w-full" />

      {/* Step rail */}
      <div className="mt-8 flex items-center gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-1 items-center gap-3">
            <div className="skeleton h-9 w-9 shrink-0 rounded-full" />
            <div className="skeleton h-4 flex-1" />
          </div>
        ))}
      </div>

      <div className="skeleton mt-8 h-96 rounded-2xl" />
      <span className="sr-only">Opening the booking flow…</span>
    </div>
  );
}
