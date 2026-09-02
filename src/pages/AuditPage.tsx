import { useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../api/client';
import { EmptyState, ErrorState, LoadingState } from '../components/Feedback';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import type { AuditLog } from '../types/domain';

const initialFilters = { action: '', entityType: '', entityId: '', from: '', to: '', limit: '50' };

export function AuditPage() {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [filters, setFilters] = useState(initialFilters);
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.get('/audit', { params: cleanParams(filters) })
      .then(({ data }) => {
        if (!active) return;
        setItems(data.items);
        setError('');
      })
      .catch((caught) => {
        if (active) setError(apiErrorMessage(caught, 'Não foi possível carregar auditoria.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filters]);

  function changeFilters(next: Partial<typeof filters>) {
    setFilters((current) => ({ ...current, ...next }));
    setLoading(true);
  }

  return (
    <div className="page">
      <PageHeader title="Auditoria" subtitle="Rastreabilidade básica para ajustes, importações, anexos e estornos." />
      {error ? <ErrorState>{error}</ErrorState> : null}

      <section className="toolbar">
        <label>Ação<input value={filters.action} onChange={(event) => changeFilters({ action: event.target.value })} /></label>
        <label>Entidade<input value={filters.entityType} onChange={(event) => changeFilters({ entityType: event.target.value })} /></label>
        <label>ID da entidade<input value={filters.entityId} onChange={(event) => changeFilters({ entityId: event.target.value })} /></label>
        <label>De<input type="date" value={filters.from} onChange={(event) => changeFilters({ from: event.target.value })} /></label>
        <label>Até<input type="date" value={filters.to} onChange={(event) => changeFilters({ to: event.target.value })} /></label>
        <label>Limite<select value={filters.limit} onChange={(event) => changeFilters({ limit: event.target.value })}><option value="25">25</option><option value="50">50</option><option value="100">100</option><option value="200">200</option></select></label>
      </section>

      <section className="panel table-panel">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Data</th><th>Usuário</th><th>Ação</th><th>Entidade</th><th>ID</th><th>Detalhe</th></tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={item._id}>
                  <td>{formatDateTime(item.createdAt)}</td>
                  <td>{userLabel(item.userId)}</td>
                  <td><span className="status-badge status-confirmed">{actionLabel(item.action)}</span></td>
                  <td>{item.entityType}</td>
                  <td><code>{item.entityId}</code></td>
                  <td><button className="link-button" onClick={() => setSelected(item)}>Abrir</button></td>
                </tr>
              ))}
              {!loading && items.length === 0 ? <tr><td colSpan={6}><EmptyState>Nenhum registro de auditoria encontrado.</EmptyState></td></tr> : null}
            </tbody>
          </table>
        </div>
        {loading ? <LoadingState>Carregando auditoria...</LoadingState> : null}
      </section>

      {selected ? (
        <Modal title="Detalhe da auditoria" subtitle={`${selected.entityType} · ${selected.entityId}`} onClose={() => setSelected(null)}>
          <div className="audit-detail">
            <div><strong>Antes</strong><pre>{formatJson(selected.before)}</pre></div>
            <div><strong>Depois</strong><pre>{formatJson(selected.after)}</pre></div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function cleanParams(params: Record<string, string>) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value));
}

function userLabel(user: AuditLog['userId']) {
  if (typeof user === 'string') return user;
  return user.name ?? user.email ?? user._id;
}

function actionLabel(action: string) {
  return action.replaceAll('_', ' ');
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR');
}

function formatJson(value: unknown) {
  return JSON.stringify(value ?? null, null, 2);
}
