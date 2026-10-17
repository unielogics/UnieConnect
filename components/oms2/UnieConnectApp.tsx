import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { CtxMenuProvider } from './ContextMenu';
import { Sidebar, buildSidebarNav, featureForScreen, isCoreScreen, SCREEN_FEATURES } from './Sidebar';
import { TopBar } from './TopBar';
import { FulfillmentPausedBanner } from './FulfillmentPausedBanner';
import { SelectionBar, SelSku } from './SelectionBar';
import { Icon } from './icons';
import { AICopilot } from './AICopilot';
import { ShipmentWizard } from './ShipmentWizard';
import { OrderModal } from './OrderModal';
import { AsnModal } from './AsnModal';
import { emitOmsNavigationStart } from './ui';
import { CommandCenter } from './screens/CommandCenter';
import { BusinessDouble } from './screens/BusinessDouble';
import { InventoryPlan } from './screens/InventoryPlan';
import { ProductResearch } from './screens/ProductResearch';
import { InventoryNetwork } from './screens/InventoryNetwork';
import { Warehouses } from './screens/Warehouses';
import { SkuDetail } from './screens/SkuDetail';
import { Orders } from './screens/Orders';
import { Returns } from './screens/Returns';
import { Shipments } from './screens/Shipments';
import { Customers } from './screens/Customers';
import { Suppliers } from './screens/Suppliers';
import { Heatmap } from './screens/Heatmap';
import { LabelAudit } from './screens/LabelAudit';
import { Billing } from './screens/Billing';
import { Audits } from './screens/Audits';
import { Marketplace } from './screens/Marketplace';
import { Support } from './screens/Support';
import { Inbox } from './screens/Inbox';
import { Connections } from './screens/Connections';
import { Ledger } from './screens/Ledger';
import { ProfileSettings } from './screens/ProfileSettings';
import { NewProductModal } from './modals/NewProductModal';
import { NewSupplierModal } from './modals/NewSupplierModal';
import { NewCustomerModal } from './modals/NewCustomerModal';
import { NewOrderModal } from './modals/NewOrderModal';
import { NewTicketModal } from './modals/NewTicketModal';
import { CsvImportModal, CsvImportEntity } from './modals/CsvImportModal';
import { StateDetailModal } from './modals/StateDetailModal';
import type { OmsAsnDetail, OmsGlobalSearchResult, OmsOrder, OmsSku, OmsSupplier } from '../../lib/oms';
import { archiveOmsSkus, fetchOmsAsn, fetchOmsOrder } from '../../lib/oms';
import { fetchCurrentUser, type CurrentUser } from '../../lib/user';
import { fetchUserFeatures, type Feature } from '../../lib/features';

export type Tweaks = { theme: 'light' | 'dark'; accent: string; density: 'comfortable' | 'compact' };
export const ACCENT_OPTIONS = ['#3157f6', '#6d28d9', '#0d9488', '#db2777'];
const TWEAK_KEY = 'uc-oms-tweaks';
const DEFAULT_TWEAKS: Tweaks = { theme: 'light', accent: '#3157f6', density: 'comfortable' };

const csvCell = (value: unknown) => {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export type NavFn = (target: string, payload?: string) => void;

const OMS_SCREEN_IDS = new Set([
  'command', 'double', 'plan', 'product-research', 'skus', 'warehouses', 'sku-detail',
  'orders', 'returns', 'customers', 'suppliers', 'shipments', 'heatmap', 'labels',
  'billing', 'audits', 'marketplace', 'support', 'inbox', 'connections', 'ledger', 'profile',
]);

export interface ScreenProps {
  onNavigate: NavFn;
  toggleSelect: (sku: SelSku) => void;
  isSelected: (id: string) => boolean;
  selectedSkus?: SelSku[];
  onOpenOrder?: (o: OmsOrder) => void;
  onOpenOrderById?: (orderId: string) => void;
  onOpenAsnById?: (asnId: string) => void;
  onCreateShipmentWithSupplier?: (supplierId: string, skus: SelSku[]) => void;
  onNewProduct?: () => void;
  onNewSupplier?: (onCreated?: (supplier?: OmsSupplier) => void) => void;
  onNewCustomer?: () => void;
  onNewOrder?: () => void;
  onNewTicket?: () => void;
  onImportCsv?: (entity: CsvImportEntity) => void;
  onSelectState?: (state: string) => void;
  onFeaturesChanged?: () => void;
  skuId?: string | null;
}

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
  const [asnModal, setAsnModal] = useState<OmsAsnDetail | null>(null);
  const [asnModalLoading, setAsnModalLoading] = useState(false);
  const [forcedSupplierId, setForcedSupplierId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [userLoadComplete, setUserLoadComplete] = useState(false);
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [newSupplierOpen, setNewSupplierOpen] = useState(false);
  const [newSupplierCreatedHandler, setNewSupplierCreatedHandler] = useState<((supplier?: OmsSupplier) => void) | null>(null);
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
    emitOmsNavigationStart();
    setShowWizard(false);
    setOrderModal(null);
    setAsnModal(null);
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
    const requestedView = (router.query.view as string) || 'command';
    const v = OMS_SCREEN_IDS.has(requestedView) ? requestedView : 'command';
    setSection(v);
    if (v === 'sku-detail') setSkuDetailId((router.query.sku as string) || null);
    if (router.query.openCortex === '1') setCopilotOpen(true);
  }, [router.isReady, router.query.view, router.query.sku, router.query.openCortex]);

  const navigate: NavFn = useCallback(
    (target, payload) => {
      closeTransientUi();
      const safeTarget = OMS_SCREEN_IDS.has(target) ? target : 'command';
      const q: Record<string, string> = { view: safeTarget };
      if (safeTarget === 'sku-detail') {
        const id = payload || skuDetailId || '';
        setSkuDetailId(id);
        if (id) q.sku = id;
      }
      if (safeTarget === 'skus' && payload?.startsWith('filter:')) {
        q.filter = payload.slice('filter:'.length);
      }
      if (safeTarget === 'suppliers' && payload?.startsWith('filter:')) {
        q.filter = payload.slice('filter:'.length);
      }
      if (safeTarget === 'connections' && payload) {
        q.connection = payload;
      }
      setSection(safeTarget);
      router.push({ pathname: '/oms', query: q }, undefined, { shallow: true });
    },
    [closeTransientUi, router, skuDetailId]
  );

  const toggleSelect = useCallback((sku: SelSku & { supplierId?: string | null }) => {
    setSelectedSkus((prev) =>
      prev.find((s) => s.id === sku.id) ? prev.filter((s) => s.id !== sku.id) : [...prev, sku]
    );
    if ('supplierId' in sku) setSkuSupplierMap((m) => ({ ...m, [sku.id]: sku.supplierId ?? null }));
  }, []);

  const isSelected = useCallback((id: string) => selectedSkus.some((s) => s.id === id), [selectedSkus]);

  const openOrderById = useCallback((orderId: string) => {
    fetchOmsOrder(orderId)
      .then((res) => setOrderModal(res.order))
      .catch(() => {});
  }, []);

  const openAsnById = useCallback((asnId: string) => {
    setAsnModalLoading(true);
    fetchOmsAsn(asnId)
      .then((res) => setAsnModal(res.asn))
      .catch(() => setAsnModal(null))
      .finally(() => setAsnModalLoading(false));
  }, []);

  const openSearchResult = useCallback((result: OmsGlobalSearchResult) => {
    if (result.type === 'order') {
      openOrderById(result.id);
      return;
    }
    if (result.type === 'asn') {
      openAsnById(result.id);
      return;
    }
    navigate(result.screen, result.entityId);
  }, [navigate, openAsnById, openOrderById]);

  const supplierMixed = useMemo(() => {
    if (selectedSkus.length < 2) return false;
    const sups = selectedSkus.map((s) => skuSupplierMap[s.id]).filter((x) => x != null);
    if (sups.length < 2) return false;
    return new Set(sups).size > 1;
  }, [selectedSkus, skuSupplierMap]);

  const exportSelectedSkus = useCallback(() => {
    const columns: Array<[string, (item: SelSku) => unknown]> = [
      ['SKU', (item) => item.sku || item.id],
      ['Title', (item) => item.title || item.name],
      ['Supplier ID', (item) => item.supplierId || ''],
      ['Available', (item) => item.available ?? ''],
      ['Inbound', (item) => item.inbound ?? ''],
      ['30-day velocity', (item) => item.velocity30d ?? ''],
      ['Days of cover', (item) => item.daysOfCover ?? ''],
      ['Risk', (item) => item.risk ?? ''],
      ['Service tier', (item) => item.serviceTier ?? ''],
    ];
    const csv = [
      columns.map(([label]) => csvCell(label)).join(','),
      ...selectedSkus.map((item) => columns.map(([, value]) => csvCell(value(item))).join(',')),
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `unieconnect-skus-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [selectedSkus]);

  const archiveSelectedSkus = useCallback(async () => {
    const result = await archiveOmsSkus(selectedSkus.map((item) => item.id));
    if (result.archivedCount !== selectedSkus.length) {
      throw new Error(`Archived ${result.archivedCount} of ${selectedSkus.length} selected SKUs. Refresh and try again.`);
    }
    setSelectedSkus([]);
    setSkuSupplierMap((current) => {
      const next = { ...current };
      result.archivedIds.forEach((id) => delete next[id]);
      return next;
    });
    bumpScreen();
  }, [bumpScreen, selectedSkus]);

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

  const openNewSupplier = useCallback((onCreated?: (supplier?: OmsSupplier) => void) => {
    setNewSupplierCreatedHandler(() => onCreated || null);
    setNewSupplierOpen(true);
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
    selectedSkus,
    onOpenOrderById: openOrderById,
    onOpenAsnById: openAsnById,
    onOpenOrder: setOrderModal,
    onCreateShipmentWithSupplier: createShipmentForSupplier,
    onNewProduct: () => setNewProductOpen(true),
    onNewSupplier: openNewSupplier,
    onNewCustomer: () => setNewCustomerOpen(true),
    onNewOrder: () => setNewOrderOpen(true),
    onNewTicket: () => setNewTicketOpen(true),
    onImportCsv: (entity) => setCsvImport(entity),
    onSelectState: (s: string) => setStateDetail(s),
    onFeaturesChanged: reloadUserFeatures,
  };

  const screens: Record<string, React.ReactNode> = {
    command: <CommandCenter {...sp} />,
    double: <BusinessDouble {...sp} />,
    plan: <InventoryPlan {...sp} />,
    'product-research': <ProductResearch {...sp} />,
    skus: <InventoryNetwork {...sp} />,
    warehouses: <Warehouses {...sp} />,
    'sku-detail': <SkuDetail {...sp} skuId={skuDetailId} />,
    orders: <Orders {...sp} />,
    returns: <Returns {...sp} />,
    customers: <Customers {...sp} />,
    suppliers: <Suppliers {...sp} />,
    shipments: <Shipments {...sp} />,
    heatmap: <Heatmap {...sp} />,
    labels: <LabelAudit {...sp} />,
    billing: <Billing {...sp} />,
    audits: <Audits {...sp} />,
    marketplace: <Marketplace {...sp} />,
    support: <Support {...sp} />,
    inbox: <Inbox {...sp} />,
    connections: <Connections {...sp} />,
    ledger: <Ledger {...sp} />,
    profile: <ProfileSettings {...sp} />,
  };
  const cortexEntity = orderModal?.id
    ? { type: 'order', id: orderModal.id }
    : asnModal?.id
      ? { type: 'asn', id: asnModal.id }
      : section === 'sku-detail' && skuDetailId
        ? { type: 'sku', id: skuDetailId }
        : null;

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
              onOpenProfile={() => navigate('profile')}
              onNavigate={navigate}
              onSelectSearchResult={openSearchResult}
            />
            <FulfillmentPausedBanner user={currentUser} />
            <React.Fragment key={`${section}-${screenKey}`}>
              {screens[section] || <CommandCenter {...sp} />}
            </React.Fragment>
          </div>
          {copilotOpen && (
            <AICopilot
              section={section}
              entityType={cortexEntity?.type}
              entityId={cortexEntity?.id}
              onClose={() => setCopilotOpen(false)}
              onNavigate={navigate}
            />
          )}

          <SelectionBar
            count={selectedSkus.length}
            items={selectedSkus}
            supplierMixed={supplierMixed}
            onClear={() => setSelectedSkus([])}
            onCreateShipment={() => setShowWizard(true)}
            onExport={exportSelectedSkus}
            onArchive={archiveSelectedSkus}
          />

          {showWizard && (
            <ShipmentWizard
              skus={selectedSkus}
              forcedSupplierId={forcedSupplierId}
              onNewSupplier={openNewSupplier}
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

          {(asnModal || asnModalLoading) && (
            <AsnModal
              asn={asnModal}
              loading={asnModalLoading && !asnModal}
              onClose={() => setAsnModal(null)}
              onNavigate={navigate}
            />
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
              onClose={() => {
                setNewSupplierOpen(false);
                setNewSupplierCreatedHandler(null);
              }}
              onSuccess={(supplier) => {
                setNewSupplierOpen(false);
                newSupplierCreatedHandler?.(supplier);
                setNewSupplierCreatedHandler(null);
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
        </div>
      </CtxMenuProvider>
    </div>
  );
}
