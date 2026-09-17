"use client";

export function ResolvingState() {
  return (
    <div className="p-wait" data-testid="resolving-state">
      <strong>Identifying…</strong>
      <p>Looking up the identifier in inventory, catalog and BEUDAMED.</p>
    </div>
  );
}
