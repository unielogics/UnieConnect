import { useEffect, useState } from 'react';
import Link from 'next/link';

export type VerificationStep = {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'success' | 'error';
  detail?: string;
  externalId?: string;
};

interface CreationVerificationScreenProps {
  steps: VerificationStep[];
  allSuccess: boolean;
  errors: string[];
  planId?: string;
  onRetry?: () => void;
  onClose?: () => void;
}

export function CreationVerificationScreen({
  steps,
  allSuccess,
  errors,
  planId,
  onRetry,
  onClose,
}: CreationVerificationScreenProps) {
  return (
    <div className="sta-workflow-container" style={{ padding: '24px 0' }}>
      <h3 style={{ marginTop: 0, marginBottom: 16 }}>Verification</h3>
      <p className="muted" style={{ marginBottom: 24 }}>
        {allSuccess
          ? 'All systems confirmed. Your shipment plan is ready.'
          : 'Some steps need attention. Review the errors below.'}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {steps.map((step) => (
          <div
            key={step.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 14,
              borderRadius: 10,
              border: '1px solid var(--border)',
              background:
                step.status === 'success'
                  ? 'color-mix(in srgb, var(--accent) 8%, var(--surface))'
                  : step.status === 'error'
                    ? 'color-mix(in srgb, #b45309 8%, var(--surface))'
                    : 'var(--surface)',
            }}
          >
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                fontWeight: 700,
                background:
                  step.status === 'success'
                    ? 'var(--accent)'
                    : step.status === 'error'
                      ? '#b45309'
                      : step.status === 'in_progress'
                        ? 'color-mix(in srgb, var(--accent) 40%, var(--surface))'
                        : 'var(--border)',
                color: step.status === 'success' || step.status === 'error' ? '#fff' : 'var(--muted)',
              }}
            >
              {step.status === 'success' ? '✓' : step.status === 'error' ? '!' : step.status === 'in_progress' ? '…' : '○'}
            </span>
            <div style={{ flex: 1 }}>
              <strong>{step.label}</strong>
              {step.detail && (
                <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                  {step.detail}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {errors.length > 0 && (
        <div className="alert error" style={{ marginBottom: 24 }}>
          {errors.map((e, i) => (
            <div key={i}>{e}</div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {planId && (
          <Link href={`/shipment-plans/${planId}`} className="button-primary" onClick={onClose}>
            View plan
          </Link>
        )}
        {!allSuccess && onRetry && (
          <button className="button-secondary" onClick={onRetry}>
            Retry failed steps
          </button>
        )}
        <Link href="/shipment-plans" className="button-secondary" onClick={onClose}>
          Back to list
        </Link>
      </div>
    </div>
  );
}
