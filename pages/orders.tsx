import DashboardLayout from '../components/DashboardLayout';

export default function OrdersPage() {
  return (
    <DashboardLayout title="Orders" subtitle="View and manage all orders across your sales channels">
      <div className="card">
        <div className="title">Orders Overview</div>
        <div className="muted" style={{ marginTop: 8 }}>
          Orders dashboard is coming soon. This will show all orders from your connected marketplaces.
        </div>
      </div>
    </DashboardLayout>
  );
}
