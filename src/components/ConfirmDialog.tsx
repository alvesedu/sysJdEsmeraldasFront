import { Modal } from './Modal';

type ConfirmDialogProps = {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({ title, message, confirmLabel, danger, loading, onCancel, onConfirm }: ConfirmDialogProps) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="confirm-message">{message}</p>
      <div className="modal-footer inline-actions">
        <button className="ghost-button" type="button" onClick={onCancel} disabled={loading}>Voltar</button>
        <button className={`primary-button ${danger ? 'danger-button' : ''}`} type="button" onClick={onConfirm} disabled={loading}>
          {loading ? 'Processando...' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
