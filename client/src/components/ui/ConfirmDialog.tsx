import React from 'react';
import { AlertTriangle, Info, Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
  children?: React.ReactNode;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading = false,
  children,
}) => {
  const getIcon = () => {
    switch (variant) {
      case 'danger':
        return (
          <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
        );
      case 'warning':
        return (
          <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
        );
      case 'primary':
      default:
        return (
          <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center shrink-0">
            <Info className="w-5 h-5" />
          </div>
        );
    }
  };

  const getButtonVariant = (): 'danger' | 'primary' => {
    switch (variant) {
      case 'danger':
        return 'danger';
      case 'warning':
      case 'primary':
      default:
        return 'primary';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="sm"
      footer={
        <div className="flex items-center justify-end gap-2.5 w-full">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={getButtonVariant()}
            size="sm"
            onClick={onConfirm}
            isLoading={isLoading}
            className={variant === 'warning' ? 'bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500' : undefined}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="flex items-start gap-4 pt-1">
        {getIcon()}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-slate-900 leading-snug">
            {title}
          </h3>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            {description}
          </p>
          {children && <div className="mt-3">{children}</div>}
        </div>
      </div>
    </Modal>
  );
};
