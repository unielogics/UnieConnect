import DashboardLayout from '../components/DashboardLayout';

export default function ItemsPage() {
  return (
    <DashboardLayout title="Items / Inventory" subtitle="Manage your product catalog and inventory">
      <div className="card">
        <div className="title">Items Overview</div>
        <div className="muted" style={{ marginTop: 8 }}>
          Items dashboard is coming soon. This will show all items and inventory across your channels.
        </div>
      </div>
    </DashboardLayout>
  );
}
