import React, { useState } from 'react';
import { Icon } from './icons';
import type { CurrentUser } from '../../lib/user';

/**
 * Shown app-wide (mounted once above the active screen in UnieConnectApp.tsx) when a warehouse
 * has severed this client's PRIMARY connection. 'paused' means a peer-network warehouse link
 * still exists (degraded, dismissible — support has been notified). 'blocked' means zero
 * connected warehouse links remain at all (no fallback fulfillment path — not dismissible).
 * Dismissing is a client-side-only acknowledgement: it does not change fulfillmentStatus, so a
 * fresh device/browser (or clearing storage) shows it again until support actually reconnects
 * the account, which resets fulfillmentStatus back to 'active' server-side.
 */
export function FulfillmentPausedBanner({ user }: { user: CurrentUser | null }) {
  const status = user?.fulfillmentStatus;
  const dismissKey = user ? `uc-fulfillment-banner-dismissed:${user.userId}:${user.fulfillmentStatusAt || ''}` : '';
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined' || !dismissKey) return false;
    return window.localStorage.getItem(dismissKey) === '1';
  });

  if (!status || status === 'active') return null;
  if (status === 'paused' && dismissed) return null;

  const blocked = status === 'blocked';

  return (
    <div className={`inline-banner app-wide ${blocked ? 'danger' : 'warn'}`}>
      <Icon name="warning" size={14} />
      <span>
        {blocked
          ? 'Your account currently has no connected warehouse — fulfillment is paused until we get you set up.'
          : 'Your primary warehouse relationship was paused. You can keep using UnieConnect while we help you get set up with a warehouse.'}
        {user?.fulfillmentStatusNote ? ` Reason given: ${user.fulfillmentStatusNote}.` : ''}
        {' '}Our team has been notified — reach out to support@unielogics.com with any questions.
      </span>
      {!blocked && (
        <span
          className="dismiss-x"
          onClick={() => {
            if (dismissKey) window.localStorage.setItem(dismissKey, '1');
            setDismissed(true);
          }}
        >
          <Icon name="x" size={14} />
        </span>
      )}
    </div>
  );
}
