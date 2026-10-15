import { NavLink, Outlet, useNavigate } from 'react-router-dom';

const navGroups = [
  {
    label: 'Principal',
    items: [['Dashboard', '/dashboard']]
  },
  {
    label: 'Gerenciamento',
    items: [
      ['Unidades', '/units'],
      ['Moradores', '/residents'],
      ['Categorias', '/categories'],
      ['Importações', '/imports'],
      ['Auditoria', '/audit']
    ]
  },
  {
    label: 'Operacional',
    items: [
      ['Lançamento rápido', '/quick-entry']
    ]
  },
  {
    label: 'Finanças',
    items: [
      ['Cobranças', '/charges'],
      ['Inadimplentes', '/defaulters'],
      ['Conciliação', '/reconciliation'],
      ['Despesas', '/expenses'],
      ['Contas a pagar', '/payables'],
      ['Fechamentos', '/closings']
    ]
  },
  {
    label: 'Análise',
    items: [['Relatórios', '/reports']]
  }
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
          {navGroups.map((group) => (
            <section className="nav-group" key={group.label} aria-label={group.label}>
              <p className="nav-group-title">{group.label}</p>
              {group.items.map(([label, to]) => (
                <NavLink key={to} to={to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  {label}
                </NavLink>
              ))}
            </section>
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
