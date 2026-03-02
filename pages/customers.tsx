import DashboardLayout from '../components/DashboardLayout';

export default function CustomersPage() {
  return (
    <DashboardLayout title="Customers" subtitle="Manage customer information and relationships">
      <div className="card">
        <div className="title">Customers Overview</div>
        <div className="muted" style={{ marginTop: 8 }}>
          Customers dashboard is coming soon. This will show all customers from your connected marketplaces.
        </div>
      </div>
    </DashboardLayout>
  );
}
