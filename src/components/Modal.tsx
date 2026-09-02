import type { ReactNode } from 'react';

type ModalProps = {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

export function Modal({ title, subtitle, onClose, children, footer }: ModalProps) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <div>
            <h2 id="modal-title">{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button className="ghost-button compact modal-close" type="button" onClick={onClose}>Fechar</button>
        </header>
        <div className="modal-body">{children}</div>
        {footer ? <footer className="modal-footer">{footer}</footer> : null}
      </section>
    </div>
  );
}
