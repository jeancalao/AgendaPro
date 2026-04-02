// Badge visual para o status do agendamento
import type { AppointmentStatus } from '../../hooks/useAppointments';

const CONFIG: Record<AppointmentStatus, { label: string; className: string }> = {
  PENDING:   { label: 'Pendente',   className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  CONFIRMED: { label: 'Confirmado', className: 'bg-blue-100   text-blue-700   border-blue-200'   },
  COMPLETED: { label: 'Concluído',  className: 'bg-green-100  text-green-700  border-green-200'  },
  CANCELLED: { label: 'Cancelado',  className: 'bg-red-100    text-red-700    border-red-200'    },
  NO_SHOW:   { label: 'Não veio',   className: 'bg-gray-100   text-gray-600   border-gray-200'   },
};

export function StatusBadge({ status, size = 'sm' }: {
  status: AppointmentStatus;
  size?:  'xs' | 'sm';
}) {
  const { label, className } = CONFIG[status];
  return (
    <span className={`inline-flex items-center font-medium border rounded-full
      ${size === 'xs' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1'}
      ${className}`}>
      {label}
    </span>
  );
}

// Retorna texto do status em português sem o componente visual
export function statusLabel(status: AppointmentStatus): string {
  return CONFIG[status]?.label ?? status;
}
