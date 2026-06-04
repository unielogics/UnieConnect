import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { CtxMenuProvider } from './ContextMenu';
import { Sidebar, buildSidebarNav, featureForScreen, isCoreScreen, SCREEN_FEATURES } from './Sidebar';
import { TopBar } from './TopBar';
import { SelectionBar, SelSku } from './SelectionBar';
import { Icon } from './icons';
import { AICopilot } from './AICopilot';
import { ShipmentWizard } from './ShipmentWizard';
import { OrderModal } from './OrderModal';
import { CommandCenter } from './screens/CommandCenter';
import { BusinessDouble } from './screens/BusinessDouble';
import { InventoryPlan } from './screens/InventoryPlan';
import { ProductResearch } from './screens/ProductResearch';
import { InventoryNetwork } from './screens/InventoryNetwork';
import { SkuDetail } from './screens/SkuDetail';
import { Orders } from './screens/Orders';
import { Shipments } from './screens/Shipments';
import { Customers } from './screens/Customers';
import { Suppliers } from './screens/Suppliers';
import { Heatmap } from './screens/Heatmap';
import { LabelAudit } from './screens/LabelAudit';
import { Billing } from './screens/Billing';
import { Audits } from './screens/Audits';
import { Marketplace } from './screens/Marketplace';
import { Support } from './screens/Support';
import { Connections } from './screens/Connections';
import { Ledger } from './screens/Ledger';
import { NewProductModal } from './modals/NewProductModal';
import { NewSupplierModal } from './modals/NewSupplierModal';
import { NewCustomerModal } from './modals/NewCustomerModal';
import { NewOrderModal } from './modals/NewOrderModal';
import { NewTicketModal } from './modals/NewTicketModal';
import { CsvImportModal, CsvImportEntity } from './modals/CsvImportModal';
import { StateDetailModal } from './modals/StateDetailModal';
import type { OmsOrder, OmsSku } from '../../lib/oms';
import { fetchCurrentUser, type CurrentUser } from '../../lib/user';
import { fetchUserFeatures, type Feature } from '../../lib/features';

export type Tweaks = { theme: 'light' | 'dark'; accent: string; density: 'comfortable' | 'compact'; cortexAvailable: boolean };
export const ACCENT_OPTIONS = ['#3157f6', '#6d28d9', '#0d9488', '#db2777'];
const TWEAK_KEY = 'uc-oms-tweaks';
const DEFAULT_TWEAKS: Tweaks = { theme: 'light', accent: '#3157f6', density: 'comfortable', cortexAvailable: true };

export type NavFn = (target: string, payload?: string) => void;

export interface ScreenProps {
  onNavigate: NavFn;
  toggleSelect: (sku: SelSku) => void;
  isSelected: (id: string) => boolean;
  onOpenOrder?: (o: OmsOrder) => void;
  onCreateShipmentWithSupplier?: (supplierId: string, skus: SelSku[]) => void;
  onNewProduct?: () => void;
  onNewSupplier?: () => void;
  onNewCustomer?: () => void;
  onNewOrder?: () => void;
  onNewTicket?: () => void;
  onImportCsv?: (entity: CsvImportEntity) => void;
  onSelectState?: (state: string) => void;
  onFeaturesChanged?: () => void;
  skuId?: string | null;
  cortexAvailable?: boolean;
}

const CortexDegradedBanner = () => (
  <div
    style={{
      position: 'fixed',
      bottom: 80,
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'var(--amber-soft)',
      color: 'var(--amber-text)',
      border: '1px solid var(--amber)',
      borderRadius: 8,
      padding: '8px 14px',
      fontSize: 12.5,
      fontWeight: 600,
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      boxShadow: 'var(--shadow-md)',
    }}
  >
    <Icon name="warning" size={14} />
    Cortex unavailable — AI recommendations showing cached values (12 min stale). Operating views fully functional.
  </div>
);

export default function UnieConnectApp() {
  const router = useRouter();
  const [tweaks, setTweaks] = useState<Tweaks>(DEFAULT_TWEAKS);
  const [section, setSection] = useState('command');
  const [skuDetailId, setSkuDetailId] = useState<string | null>(null);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [selectedSkus, setSelectedSkus] = useState<SelSku[]>([]);
  const [skuSupplierMap, setSkuSupplierMap] = useState<Record<string, string | null>>({});
  const [showWizard, setShowWizard] = useState(false);
  const [orderModal, setOrderModal] = useState<OmsOrder | null>(null);
  const [forcedSupplierId, setForcedSupplierId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [userLoadComplete, setUserLoadComplete] = useState(false);
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [newSupplierOpen, setNewSupplierOpen] = useState(false);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [csvImport, setCsvImport] = useState<CsvImportEntity | null>(null);
  const [stateDetail, setStateDetail] = useState<string | null>(null);
  const [screenKey, setScreenKey] = useState(0);
  const [userFeatures, setUserFeatures] = useState<Feature[]>([]);
  const [featureLoadComplete, setFeatureLoadComplete] = useState(false);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const bumpScreen = useCallback(() => setScreenKey((k) => k + 1), []);

  const closeTransientUi = useCallback(() => {
    setShowWizard(false);
    setOrderModal(null);
    setForcedSupplierId(null);
    setNewProductOpen(false);
    setNewSupplierOpen(false);
    setNewCustomerOpen(false);
    setNewOrderOpen(false);
    setNewTicketOpen(false);
    setCsvImport(null);
    setStateDetail(null);
  }, []);

  // Load tweaks from storage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(TWEAK_KEY);
      if (raw) setTweaks({ ...DEFAULT_TWEAKS, ...JSON.parse(raw) });
      else {
        const legacy = localStorage.getItem('unie-theme');
        if (legacy === 'dark' || legacy === 'light') setTweaks((t) => ({ ...t, theme: legacy }));
      }
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser()
      .then((u) => {
        if (u) setCurrentUser(u);
      })
      .catch(() => {})
      .finally(() => setUserLoadComplete(true));
  }, []);

  const reloadUserFeatures = useCallback(() => {
    let cancelled = false;
    setFeatureLoadComplete(false);
    fetchUserFeatures()
      .then((result) => {
        if (!cancelled) setUserFeatures(result.features || []);
      })
      .catch(() => {
        if (!cancelled) setUserFeatures([]);
      })
      .finally(() => {
        if (!cancelled) setFeatureLoadComplete(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!userLoadComplete) return;
    if (!currentUser) {
      setFeatureLoadComplete(true);
      return;
    }
    return reloadUserFeatures();
  }, [currentUser, reloadUserFeatures, userLoadComplete]);

  const setTweak = useCallback(<K extends keyof Tweaks>(k: K, v: Tweaks[K]) => {
    setTweaks((prev) => {
      const next = { ...prev, [k]: v };
      try {
        localStorage.setItem(TWEAK_KEY, JSON.stringify(next));
        if (k === 'theme') localStorage.setItem('unie-theme', String(v));
      } catch {
        /* noop */
      }
      return next;
    });
  }, []);

  // Sync section from URL (?view= & ?sku=)
  useEffect(() => {
    if (!router.isReady) return;
    const v = (router.query.view as string) || 'command';
    setSection(v);
    if (v === 'sku-detail') setSkuDetailId((router.query.sku as string) || null);
  }, [router.isReady, router.query.view, router.query.sku]);

  const navigate: NavFn = useCallback(
    (target, payload) => {
      closeTransientUi();
      const q: Record<string, string> = { view: target };
      if (target === 'sku-detail') {
        const id = payload || skuDetailId || '';
        setSkuDetailId(id);
        if (id) q.sku = id;
      }
      setSection(target);
      router.push({ pathname: '/oms', query: q }, undefined, { shallow: true });
    },
    [closeTransientUi, router, skuDetailId]
  );

  const toggleSelect = useCallback((sku: SelSku & { supplierId?: string | null }) => {
    setSelectedSkus((prev) => {
      const existing = prev.find((s) => s.id === sku.id);
      if (!existing) return [...prev, { ...sku, name: sku.name || sku.sku || sku.id }];
      if (sku.fbaIntent && !existing.fbaIntent) {
        return prev.map((s) => (s.id === sku.id ? { ...s, ...sku, name: sku.name || s.name || sku.sku || sku.id, fbaIntent: true } : s));
      }
      return prev.filter((s) => s.id !== sku.id);
    });
    if ('supplierId' in sku) setSkuSupplierMap((m) => ({ ...m, [sku.id]: sku.supplierId ?? null }));
  }, []);

  const isSelected = useCallback((id: string) => selectedSkus.some((s) => s.id === id), [selectedSkus]);

  const supplierMixed = useMemo(() => {
    if (selectedSkus.length < 2) return false;
    const sups = selectedSkus.map((s) => skuSupplierMap[s.id]).filter((x) => x != null);
    if (sups.length < 2) return false;
    return new Set(sups).size > 1;
  }, [selectedSkus, skuSupplierMap]);

  const enabledFeatureIds = useMemo(() => {
    const ids = new Set<string>();
    userFeatures.forEach((feature) => {
      const status = feature.userStatus || (feature.isEnabled ? 'enabled' : 'available');
      if (feature.isEnabled || feature.isStandard || status === 'enabled') ids.add(feature.id);
    });
    return ids;
  }, [userFeatures]);

  const nav = useMemo(() => buildSidebarNav(enabledFeatureIds, false), [enabledFeatureIds]);

  const isScreenAvailable = useCallback(
    (screenId: string) => {
      if (isCoreScreen(screenId)) return true;
      const featureId = featureForScreen(screenId);
      return !!featureId && enabledFeatureIds.has(featureId);
    },
    [enabledFeatureIds]
  );

  const createShipmentForSupplier = useCallback((supplierId: string, skus: SelSku[]) => {
    setSelectedSkus(skus);
    setForcedSupplierId(supplierId);
    setShowWizard(true);
  }, []);

  useEffect(() => {
    if (!router.isReady || !featureLoadComplete || !userLoadComplete) return;
    if (isScreenAvailable(section)) return;
    const featureId = featureForScreen(section) || SCREEN_FEATURES[section] || '';
    closeTransientUi();
    setSection('marketplace');
    router.replace(
      { pathname: '/oms', query: { view: 'marketplace', install: featureId } },
      undefined,
      { shallow: true }
    );
  }, [closeTransientUi, featureLoadComplete, isScreenAvailable, router, section, userLoadComplete]);

  // Apply theme/density/accent to shell root only
  const shellRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    el.dataset.theme = tweaks.theme;
    el.dataset.density = tweaks.density;
    el.style.setProperty('--accent', tweaks.accent);
    el.style.setProperty('--accent-hover', tweaks.accent);
  }, [tweaks]);

  useEffect(() => {
    if (!userLoadComplete || currentUser) return;
    window.location.href = '/login';
  }, [currentUser, userLoadComplete]);

  if (!userLoadComplete) {
    return (
      <div className="uc-shell" ref={shellRef} data-theme={tweaks.theme} data-density={tweaks.density}>
        <div className="app">
          <div className="workspace">
            <div className="loading-state">Loading account...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) return null;

  const sp: ScreenProps = {
    onNavigate: navigate,
    toggleSelect,
    isSelected,
    onOpenOrder: setOrderModal,
    onCreateShipmentWithSupplier: createShipmentForSupplier,
    onNewProduct: () => setNewProductOpen(true),
    onNewSupplier: () => setNewSupplierOpen(true),
    onNewCustomer: () => setNewCustomerOpen(true),
    onNewOrder: () => setNewOrderOpen(true),
    onNewTicket: () => setNewTicketOpen(true),
    onImportCsv: (entity) => setCsvImport(entity),
    onSelectState: (s: string) => setStateDetail(s),
    onFeaturesChanged: reloadUserFeatures,
    cortexAvailable: tweaks.cortexAvailable,
  };

  const screens: Record<string, React.ReactNode> = {
    command: <CommandCenter {...sp} />,
    double: <BusinessDouble {...sp} />,
    plan: <InventoryPlan {...sp} />,
    'product-research': <ProductResearch {...sp} />,
    skus: <InventoryNetwork {...sp} />,
    'sku-detail': <SkuDetail {...sp} skuId={skuDetailId} />,
    orders: <Orders {...sp} />,
    customers: <Customers {...sp} />,
    suppliers: <Suppliers {...sp} />,
    shipments: <Shipments {...sp} />,
    heatmap: <Heatmap {...sp} />,
    labels: <LabelAudit {...sp} />,
    billing: <Billing {...sp} />,
    audits: <Audits {...sp} />,
    marketplace: <Marketplace {...sp} />,
    support: <Support {...sp} />,
    connections: <Connections {...sp} />,
    ledger: <Ledger {...sp} />,
  };

  return (
    <div className="uc-shell" ref={shellRef} data-theme={tweaks.theme} data-density={tweaks.density}>
      <CtxMenuProvider>
        <div className={`app ${copilotOpen ? 'copilot-open' : ''} ${sidePanelOpen ? 'nav-panel-open' : ''}`}>
          <Sidebar
            active={section}
            onNavigate={navigate}
            onInteract={closeTransientUi}
            onPanelOpenChange={setSidePanelOpen}
            nav={nav}
            user={currentUser}
          />
          <div className="workspace">
            <TopBar
              section={section}
              copilotOpen={copilotOpen}
              onToggleCopilot={() => setCopilotOpen((o) => !o)}
              theme={tweaks.theme}
              onToggleTheme={() => setTweak('theme', tweaks.theme === 'dark' ? 'light' : 'dark')}
            />
            <React.Fragment key={`${section}-${screenKey}`}>
              {screens[section] || <CommandCenter {...sp} />}
            </React.Fragment>
          </div>
          {copilotOpen && (
            <AICopilot
              section={section}
              onClose={() => setCopilotOpen(false)}
              cortexAvailable={tweaks.cortexAvailable}
            />
          )}

          <SelectionBar
            count={selectedSkus.length}
            items={selectedSkus}
            supplierMixed={supplierMixed}
            onClear={() => setSelectedSkus([])}
            onCreateShipment={() => setShowWizard(true)}
            onExport={() => {}}
            onDelete={() => setSelectedSkus([])}
          />

          {showWizard && (
            <ShipmentWizard
              skus={selectedSkus}
              forcedSupplierId={forcedSupplierId}
              onClose={() => {
                setShowWizard(false);
                setForcedSupplierId(null);
              }}
              onComplete={() => {
                setShowWizard(false);
                setSelectedSkus([]);
                setForcedSupplierId(null);
                navigate('shipments');
              }}
            />
          )}

          {orderModal && (
            <OrderModal order={orderModal} onClose={() => setOrderModal(null)} onNavigate={navigate} />
          )}

          {newProductOpen && (
            <NewProductModal
              onClose={() => setNewProductOpen(false)}
              onSuccess={() => {
                setNewProductOpen(false);
                bumpScreen();
              }}
            />
          )}
          {newSupplierOpen && (
            <NewSupplierModal
              onClose={() => setNewSupplierOpen(false)}
              onSuccess={() => {
                setNewSupplierOpen(false);
                bumpScreen();
              }}
            />
          )}
          {newCustomerOpen && (
            <NewCustomerModal
              onClose={() => setNewCustomerOpen(false)}
              onSuccess={() => {
                setNewCustomerOpen(false);
                bumpScreen();
              }}
            />
          )}
          {newOrderOpen && (
            <NewOrderModal
              onClose={() => setNewOrderOpen(false)}
              onSuccess={() => {
                setNewOrderOpen(false);
                bumpScreen();
              }}
            />
          )}
          {newTicketOpen && (
            <NewTicketModal
              onClose={() => setNewTicketOpen(false)}
              onSuccess={() => {
                setNewTicketOpen(false);
                bumpScreen();
              }}
            />
          )}

          {csvImport && (
            <CsvImportModal
              entity={csvImport}
              onClose={() => setCsvImport(null)}
              onSuccess={() => {
                setCsvImport(null);
                bumpScreen();
              }}
            />
          )}
          {stateDetail && (
            <StateDetailModal stateCode={stateDetail} onClose={() => setStateDetail(null)} />
          )}

          {!tweaks.cortexAvailable && <CortexDegradedBanner />}
        </div>
      </CtxMenuProvider>
    </div>
  );
}
