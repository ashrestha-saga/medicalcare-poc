export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      role="progressbar"
      aria-label="Loading"
    />
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <div className="p-stage">
      <div className="p-wait">
        <Spinner />
        <strong style={{ marginTop: 12 }}>{label}</strong>
      </div>
    </div>
  );
}
