import { NavLink, Outlet, useNavigate } from 'react-router-dom';

const items = [
  ['Dashboard', '/dashboard'],
  ['Unidades', '/units'],
  ['Moradores', '/residents'],
  ['Cobranças', '/charges'],
  ['Importações', '/imports'],
  ['Conciliação', '/reconciliation'],
  ['Despesas', '/expenses'],
  ['Contas a pagar', '/payables'],
  ['Fechamentos', '/closings'],
  ['Categorias', '/categories'],
  ['Auditoria', '/audit']
] as const;

export function AppShell() {
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand">Condomínio Financeiro</div>
          <p className="brand-subtitle">MVP de gestão operacional</p>
        </div>
        <nav className="nav">
          {items.map(([label, to]) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              {label}
            </NavLink>
          ))}
        </nav>
        <button
          className="ghost-button"
          onClick={() => {
            localStorage.removeItem('auth_token');
            navigate('/login');
          }}
        >
          Sair
        </button>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
