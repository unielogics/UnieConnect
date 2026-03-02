import { useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/router';
import { fetchFeature, Feature } from '../lib/features';
import DashboardLayout from './DashboardLayout';

interface FeatureGuardProps {
  featureSlug: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export default function FeatureGuard({ featureSlug, children, fallback }: FeatureGuardProps) {
  const router = useRouter();
  const [feature, setFeature] = useState<Feature | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    void checkAccess();
  }, [featureSlug]);

  const checkAccess = async () => {
    try {
      const f = await fetchFeature(featureSlug);
      setFeature(f);
      setHasAccess(f.isStandard || f.isEnabled === true);
    } catch (err) {
      console.error('Failed to check feature access:', err);
      setHasAccess(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Loading...">
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div className="muted">Checking access...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!hasAccess && feature) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <DashboardLayout title="Feature Not Enabled" subtitle={feature.name}>
        <div className="card" style={{ maxWidth: 600, margin: '0 auto' }}>
          <div className="title" style={{ marginBottom: 12 }}>
            {feature.name} is not enabled
          </div>
          <div className="muted" style={{ marginBottom: 20 }}>
            {feature.description}
          </div>
          {feature.pricing.type === 'free' ? (
            <div>
              <button
                className="button-primary"
                onClick={async () => {
                  try {
                    const { enableFeature } = await import('../lib/features');
                    await enableFeature(feature.slug);
                    await checkAccess();
                  } catch (err: any) {
                    alert(err?.message || 'Failed to enable feature');
                  }
                }}
              >
                Enable {feature.name}
              </button>
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: 12 }}>
                <strong>Pricing:</strong>{' '}
                {feature.pricing.type === 'subscription'
                  ? `$${feature.pricing.amount}/month`
                  : `$${feature.pricing.amount} one-time`}
                {feature.pricing.trialDays && feature.pricing.trialDays > 0 && (
                  <span> ({feature.pricing.trialDays} day trial)</span>
                )}
              </div>
              <button
                className="button-primary"
                onClick={() => router.push('/marketplace')}
              >
                View in Marketplace
              </button>
            </div>
          )}
        </div>
      </DashboardLayout>
    );
  }

  return <>{children}</>;
}
