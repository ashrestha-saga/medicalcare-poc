"use client";

export function QtyStepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="p-qty" data-testid="qty-stepper">
      <button type="button" onClick={() => onChange(Math.max(0, value - 1))} aria-label="Decrease">
        −
      </button>
      <b>{value}</b>
      <button type="button" onClick={() => onChange(value + 1)} aria-label="Increase">
        +
      </button>
    </div>
  );
}
