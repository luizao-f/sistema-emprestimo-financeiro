import React from 'react';
import { Badge } from '@/components/ui/badge';
import { LoanStatus, PaymentStatus } from '@/types/database';

interface StatusBadgeProps {
  status: LoanStatus | PaymentStatus;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const getStatusConfig = (status: LoanStatus | PaymentStatus) => {
    switch (status) {
      case 'ativo':
        return { variant: 'default' as const, text: 'Ativo', className: 'bg-success text-success-foreground' };
      case 'pendente':
        return { variant: 'secondary' as const, text: 'Pendente', className: 'bg-warning text-warning-foreground' };
      case 'finalizado':
        return { variant: 'outline' as const, text: 'Finalizado' };
      case 'pago':
        return { variant: 'default' as const, text: 'Pago', className: 'bg-success text-success-foreground' };
      case 'atrasado':
        return { variant: 'destructive' as const, text: 'Atrasado' };
      default:
        return { variant: 'outline' as const, text: status };
    }
  };

  const config = getStatusConfig(status);
  
  return (
    <Badge 
      variant={config.variant} 
      className={`${config.className || ''} ${className || ''}`}
    >
      {config.text}
    </Badge>
  );
};