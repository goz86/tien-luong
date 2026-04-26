import { ReactNode } from 'react';

export function FinanceMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="finance-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field-wrap">
      <span>{label}</span>
      {children}
    </label>
  );
}
