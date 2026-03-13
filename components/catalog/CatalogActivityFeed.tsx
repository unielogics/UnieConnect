interface ActivityLog {
  id: string;
  timestamp: string;
  action: string;
  userName: string;
  details?: unknown;
}

interface CatalogActivityFeedProps {
  activityLogs?: ActivityLog[];
  limit?: number;
}

export function CatalogActivityFeed({
  activityLogs,
  limit = 20,
}: CatalogActivityFeedProps) {
  if (!activityLogs || activityLogs.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-4">No activity logged for this item</div>
    );
  }

  const displayLogs = activityLogs.slice(0, limit);

  return (
    <div className="max-h-64 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50/50">
      {displayLogs.map((log) => (
        <div
          key={log.id}
          className="flex justify-between items-start gap-3 text-sm border-b border-gray-100 pb-2 last:border-0 last:pb-0"
        >
          <span className="text-gray-700 flex-1 truncate">
            {log.action.replace(/_/g, ' ')}
          </span>
          <span className="text-gray-500 text-xs whitespace-nowrap">
            {log.userName}
            {log.timestamp && (
              <> · {new Date(log.timestamp).toLocaleString()}</>
            )}
          </span>
        </div>
      ))}
      {activityLogs.length > limit && (
        <p className="text-xs text-gray-500 pt-2">
          Showing {limit} of {activityLogs.length} activities
        </p>
      )}
    </div>
  );
}
