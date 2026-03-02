import DashboardLayout from '../components/DashboardLayout';

export default function ActivityPage() {
  return (
    <DashboardLayout title="Activity" subtitle="View system activity logs and events">
      <div className="card">
        <div className="title">Activity Log</div>
        <div className="muted" style={{ marginTop: 8 }}>
          Activity dashboard is coming soon. This will show system events, syncs, and activity logs.
        </div>
      </div>
    </DashboardLayout>
  );
}
