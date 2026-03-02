import { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { fetchMarketplaceFeatures, enableFeature, disableFeature, Feature } from '../lib/features';

export default function MarketplacePage() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [pricingFilter, setPricingFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    void loadFeatures();
  }, [selectedCategory, pricingFilter, statusFilter]);

  const loadFeatures = async () => {
    setLoading(true);
    try {
      const data = await fetchMarketplaceFeatures({
        search: search || undefined,
        category: selectedCategory || undefined,
        pricingType: pricingFilter || undefined,
      });
      setFeatures(data.features);
      if (data.categories) {
        setCategories(data.categories);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to load features' });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    void loadFeatures();
  };

  const handleEnable = async (feature: Feature) => {
    setActionLoading(feature.id);
    setMessage(null);
    try {
      await enableFeature(feature.slug);
      setMessage({ type: 'success', text: `${feature.name} enabled successfully` });
      await loadFeatures();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to enable feature' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisable = async (feature: Feature) => {
    setActionLoading(feature.id);
    setMessage(null);
    try {
      await disableFeature(feature.slug);
      setMessage({ type: 'success', text: `${feature.name} disabled` });
      await loadFeatures();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to disable feature' });
    } finally {
      setActionLoading(null);
    }
  };

  const filteredFeatures = features.filter((f) => {
    if (statusFilter === 'enabled' && !f.isEnabled) return false;
    if (statusFilter === 'disabled' && f.isEnabled) return false;
    return true;
  });

  return (
    <DashboardLayout title="Marketplace" subtitle="Discover and enable features for your workspace">
      {message && (
        <div
          className={`alert ${message.type === 'error' ? 'error' : 'success'}`}
          style={{ marginBottom: 12 }}
        >
          {message.text}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search features..."
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              fontSize: 14,
            }}
          />
          <button type="submit" className="button-primary">
            Search
          </button>
        </form>

        <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{
              padding: 8,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              fontSize: 13,
            }}
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>

          <select
            value={pricingFilter}
            onChange={(e) => setPricingFilter(e.target.value)}
            style={{
              padding: 8,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              fontSize: 13,
            }}
          >
            <option value="">All Pricing</option>
            <option value="free">Free</option>
            <option value="one-time">One-time</option>
            <option value="subscription">Subscription</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: 8,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              fontSize: 13,
            }}
          >
            <option value="">All Status</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Not Enabled</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div className="muted">Loading features...</div>
        </div>
      ) : filteredFeatures.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div className="muted">No features found. Try adjusting your filters.</div>
        </div>
      ) : (
        <div className="card-grid">
          {filteredFeatures.map((feature) => (
            <div key={feature.id} className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div className="title" style={{ marginBottom: 4 }}>
                    {feature.metadata?.navIcon && <span style={{ marginRight: 8 }}>{feature.metadata.navIcon}</span>}
                    {feature.name}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    <span className={`badge ${feature.pricing.type === 'free' ? '' : 'status'}`}>
                      {feature.pricing.type === 'free'
                        ? 'Free'
                        : feature.pricing.type === 'subscription'
                        ? `$${feature.pricing.amount}/mo`
                        : `$${feature.pricing.amount}`}
                    </span>
                    {feature.isEnabled && (
                      <span className="badge status connected">Enabled</span>
                    )}
                    {feature.pricing.trialDays && feature.pricing.trialDays > 0 && (
                      <span className="badge" style={{ background: 'var(--accent-weak)', color: 'var(--accent)' }}>
                        {feature.pricing.trialDays} day trial
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="muted" style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>
                {feature.description}
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {feature.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="badge" style={{ fontSize: 11 }}>
                    {tag}
                  </span>
                ))}
              </div>

              <div className="card-footer">
                {feature.isEnabled ? (
                  <button
                    className="button-secondary"
                    onClick={() => void handleDisable(feature)}
                    disabled={actionLoading === feature.id}
                  >
                    {actionLoading === feature.id ? 'Disabling...' : 'Disable'}
                  </button>
                ) : (
                  <button
                    className="button-primary"
                    onClick={() => void handleEnable(feature)}
                    disabled={actionLoading === feature.id}
                  >
                    {actionLoading === feature.id
                      ? 'Enabling...'
                      : feature.pricing.type === 'free'
                      ? 'Enable'
                      : feature.pricing.type === 'subscription'
                      ? `Subscribe ($${feature.pricing.amount}/mo)`
                      : `Purchase ($${feature.pricing.amount})`}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
