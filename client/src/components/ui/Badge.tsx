import React from 'react';
import { cn } from '../../lib/utils';

export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'neutral';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  size = 'md',
  dot = false,
  children,
  ...props
}) => {
  const variantStyles: Record<BadgeVariant, string> = {
    default: 'bg-slate-100 text-slate-700 border-slate-200/80',
    primary: 'bg-primary-50 text-primary border-primary-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    error: 'bg-red-50 text-red-700 border-red-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
    neutral: 'bg-gray-100 text-gray-600 border-gray-200',
  };

  const dotColors: Record<BadgeVariant, string> = {
    default: 'bg-slate-400',
    primary: 'bg-primary',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    neutral: 'bg-gray-400',
  };

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-0.5 gap-1.5',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full border tracking-wide select-none',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColors[variant])} />}
      {children}
    </span>
  );
};

/**
 * Task Status Badge Component mapping to WorkSpace TaskStatus enum:
 * 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'TESTING' | 'DONE'
 */
export const TaskStatusBadge: React.FC<{
  status: 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'TESTING' | 'DONE';
  className?: string;
}> = ({ status, className }) => {
  const configMap = {
    BACKLOG: { label: 'Backlog', variant: 'neutral' as BadgeVariant },
    TODO: { label: 'To Do', variant: 'info' as BadgeVariant },
    IN_PROGRESS: { label: 'In Progress', variant: 'primary' as BadgeVariant },
    TESTING: { label: 'Testing', variant: 'warning' as BadgeVariant },
    DONE: { label: 'Done', variant: 'success' as BadgeVariant },
  };

  const { label, variant } = configMap[status] || { label: status, variant: 'neutral' };
  return (
    <Badge variant={variant} dot className={className}>
      {label}
    </Badge>
  );
};

/**
 * Task Priority Badge Component mapping to WorkSpace TaskPriority enum:
 * 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
 */
export const TaskPriorityBadge: React.FC<{
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  className?: string;
}> = ({ priority, className }) => {
  const configMap = {
    LOW: { label: 'Low', variant: 'neutral' as BadgeVariant },
    MEDIUM: { label: 'Medium', variant: 'info' as BadgeVariant },
    HIGH: { label: 'High', variant: 'warning' as BadgeVariant },
    URGENT: { label: 'Urgent', variant: 'error' as BadgeVariant },
  };

  const { label, variant } = configMap[priority] || { label: priority, variant: 'neutral' };
  return <Badge variant={variant} className={className}>{label}</Badge>;
};
