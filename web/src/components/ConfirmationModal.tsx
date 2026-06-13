import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDanger = false,
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay confirm-overlay">
      <div className="modal-dialog confirm-dialog">
        <div className="modal-header confirm-header">
          <h3 className="modal-title flex align-center gap-8">
            {isDanger && <AlertTriangle size={18} style={{ color: 'var(--error)' }} />}
            {title}
          </h3>
          <button className="btn-icon" onClick={onClose} aria-label="Close confirmation">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body confirm-body">
          <p className="confirm-message" style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: '1.5', fontSize: '14px' }}>{message}</p>
        </div>

        <div className="modal-footer confirm-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {cancelText}
          </button>
          <button
            type="button"
            className={`btn ${isDanger ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => {
              onConfirm();
              onClose();
            }}
            autoFocus
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
