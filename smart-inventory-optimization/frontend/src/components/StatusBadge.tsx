interface StatusBadgeProps {
  status: 'Reorder now' | 'Watch' | 'Healthy';
}

const colorMap: Record<StatusBadgeProps['status'], string> = {
  'Reorder now': 'badge-danger',
  Watch: 'badge-warning',
  Healthy: 'badge-success',
};

/**
 * Renders a colour-coded badge for inventory status.
 * Uses BOTH colour and text — never colour alone (accessibility requirement).
 */
export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`badge ${colorMap[status]}`} role="status">
      {status}
    </span>
  );
}
