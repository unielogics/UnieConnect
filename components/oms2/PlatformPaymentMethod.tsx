import React, { useEffect, useState } from 'react';
import { loadStripe, Stripe as StripeJs } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Icon } from './icons';
import { Chip } from './ui';
import {
  fetchOmsPlatformPaymentMethod,
  createOmsPlatformSetupIntent,
  detachOmsPlatformPaymentMethod,
  acceptOmsPlatformTerms,
  OmsPlatformPaymentMethodStatus,
} from '../../lib/oms';

const TERMS_VERSION = '2026-07-31';

let stripePromise: Promise<StripeJs | null> | null = null;
function getStripe() {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) return null;
  if (!stripePromise) stripePromise = loadStripe(key);
  return stripePromise;
}

function SetupForm({ termsAccepted, onDone }: { termsAccepted: boolean; onDone: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || !termsAccepted) return;
    setSubmitting(true);
    setError('');
    const { error: confirmError } = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });
    setSubmitting(false);
    if (confirmError) {
      setError(confirmError.message || 'Could not save payment method');
      return;
    }
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12, marginTop: 12 }}>
      <PaymentElement options={{ paymentMethodOrder: ['card', 'us_bank_account'] }} />
      {error && <div style={{ fontSize: 12, color: 'var(--red-text)' }}>{error}</div>}
      <button type="submit" className="btn primary" style={{ justifySelf: 'start' }} disabled={!stripe || !termsAccepted || submitting}>
        {submitting ? 'Saving…' : 'Save payment method'}
      </button>
    </form>
  );
}

/**
 * Card/ACH on file for direct-with-UnieLogics billing — lands on UnieLogics' own Stripe
 * balance (not any warehouse's Connect account), relayed to whichever warehouse(s) service the
 * account. Distinct from warehouse-collected clients, who pay through the referring warehouse's
 * own Connect card (no UI here for that — the warehouse's own Payments page owns that flow).
 */
export const PlatformPaymentMethod = () => {
  const [status, setStatus] = useState<OmsPlatformPaymentMethodStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const load = () => {
    setLoading(true);
    setErr('');
    fetchOmsPlatformPaymentMethod()
      .then(setStatus)
      .catch((e) => setErr(e.message || 'Could not load payment method'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const startSetup = async () => {
    setStarting(true);
    setErr('');
    try {
      const { clientSecret } = await createOmsPlatformSetupIntent();
      setClientSecret(clientSecret);
    } catch (e: any) {
      setErr(e.message || 'Could not start setup');
    } finally {
      setStarting(false);
    }
  };

  const onSetupDone = async () => {
    setClientSecret(null);
    try {
      await acceptOmsPlatformTerms(TERMS_VERSION);
    } catch {
      /* non-fatal — payment method is saved either way */
    }
    load();
  };

  const remove = async () => {
    if (!window.confirm('Remove this payment method? Future direct charges will fail until a new one is added.')) return;
    setRemoving(true);
    try {
      await detachOmsPlatformPaymentMethod();
      load();
    } catch (e: any) {
      setErr(e.message || 'Could not remove payment method');
    } finally {
      setRemoving(false);
    }
  };

  const stripe = getStripe();

  return (
    <div className="card-body" style={{ maxWidth: 560, display: 'grid', gap: 12 }}>
      <Chip tone="purple" dot={false}>Direct billing (UnieLogics)</Chip>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        Card or bank account UnieLogics charges directly for your account activity — used only if
        your account bills straight to UnieLogics rather than through a specific warehouse.
      </div>

      {loading ? (
        <div className="muted">Loading…</div>
      ) : err ? (
        <div style={{ fontSize: 12.5, color: 'var(--red-text)' }}>{err}</div>
      ) : clientSecret && stripe ? (
        <div>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} style={{ marginTop: 2 }} />
            <span>I authorize UnieLogics to charge this card or bank account for my account's billed activity, per its terms of service.</span>
          </label>
          <Elements stripe={stripe} options={{ clientSecret }}>
            <SetupForm termsAccepted={termsAccepted} onDone={onSetupDone} />
          </Elements>
        </div>
      ) : status?.paymentMethodStatus === 'active' ? (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Chip tone="green" dot={false}>
              {status.paymentMethodType === 'us_bank_account' ? 'Bank account' : 'Card'} on file
            </Chip>
            {status.paymentMethodLast4 && <span className="mono muted">•••• {status.paymentMethodLast4}</span>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn sm" onClick={startSetup} disabled={starting}>
              {starting ? 'Loading…' : 'Replace payment method'}
            </button>
            <button className="btn sm" style={{ color: 'var(--red-text)' }} onClick={remove} disabled={removing}>
              {removing ? 'Removing…' : 'Remove'}
            </button>
          </div>
        </div>
      ) : (
        <div>
          {status?.paymentMethodStatus === 'pending_verification' && (
            <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--amber-text)' }}>
              A bank account was added but is still verifying — this can take a few minutes.
            </div>
          )}
          {status?.paymentMethodStatus === 'failed' && (
            <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--red-text)' }}>
              Setting up the last payment method failed. Try again below.
            </div>
          )}
          <button className="btn primary sm" onClick={startSetup} disabled={starting || !stripe}>
            {starting ? 'Loading…' : 'Add payment method'}
          </button>
          {!stripe && (
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--red-text)' }}>
              <Icon name="warning" size={11} /> Stripe is not configured for this environment yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
