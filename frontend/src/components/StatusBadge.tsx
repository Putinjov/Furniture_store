import React from 'react';
import { Badge } from './Badge';

type StatusType = 'order' | 'payment' | 'delivery' | 'product';

interface StatusBadgeProps {
  status: string;
  type: StatusType;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type }) => {
  const getVariant = () => {
    if (type === 'order') {
      switch (status) {
        case 'new': return 'info';
        case 'awaiting_stock': return 'warning';
        case 'ready': return 'success';
        case 'in_delivery': return 'info';
        case 'completed': return 'success';
        case 'cancelled': return 'danger';
        default: return 'default';
      }
    }
    if (type === 'payment') {
      switch (status) {
        case 'paid': return 'success';
        case 'partially_paid': return 'warning';
        case 'unpaid': return 'danger';
        default: return 'default';
      }
    }
    if (type === 'delivery') {
      switch (status) {
        case 'pending': return 'warning';
        case 'in_delivery': return 'info';
        case 'delivered': return 'success';
        case 'failed': return 'danger';
        default: return 'default';
      }
    }
    if (type === 'product') {
      switch (status) {
        case 'in_stock': return 'success';
        case 'out_of_stock': return 'danger';
        case 'expected_soon': return 'warning';
        case 'pre_order': return 'info';
        default: return 'default';
      }
    }
    return 'default';
  };

  const formatStatus = (s: string) => s.replace(/_/g, ' ').toUpperCase();

  return <Badge text={formatStatus(status)} variant={getVariant()} />;
};
