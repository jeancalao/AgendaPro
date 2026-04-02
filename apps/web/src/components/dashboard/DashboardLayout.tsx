// Layout principal do dashboard — sidebar + header + conteúdo
import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboardSummary } from '../../hooks/useDashboardSummary';

// ─── Ícones SVG inline ───────────────────────────────────────────────────────
const Icons = {
  today:    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>,
  calendar: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/><rect x="3" y="9" width="18" height="13" rx="2" strokeWidth={0}/></svg>,
  list:     <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>,
  users:    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
  services: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>,
  clock:    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  menu:     <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg>,
  close:    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>,
  logout:   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>,
  link:     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>,
};

// ─── Nav items ───────────────────────────────────────────────────────────────
interface NavItem {
  path:    string;
  label:   string;
  icon:    React.ReactNode;
  exact?:  boolean;
  badge?:  number;
}

function buildNavItems(pendingTotal: number): NavItem[] {
  return [
    { path: '/dashboard',              label: 'Hoje',            icon: Icons.today,    exact: true },
    { path: '/dashboard/calendar',     label: 'Agenda',          icon: Icons.calendar },
    { path: '/dashboard/appointments', label: 'Agendamentos',    icon: Icons.list,     badge: pendingTotal },
    { path: '/dashboard/clients',      label: 'Clientes',        icon: Icons.users },
    { path: '/dashboard/services',     label: 'Serviços',        icon: Icons.services },
    { path: '/dashboard/availability', label: 'Disponibilidade', icon: Icons.clock },
  ];
}

// ─── DashboardLayout ─────────────────────────────────────────────────────────
export function DashboardLayout() {
  const { professional, logout } = useAuth();
  const location    = useLocation();
  const navigate    = useNavigate();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: summary } = useDashboardSummary();
  const pendingTotal = summary?.pendingTotal ?? 0;
  const navItems = buildNavItems(pendingTotal);

  // Fecha sidebar ao navegar (mobile)
  useEffect(() => { setOpen(false); }, [location.pathname]);

  async function handleCopyUrl() {
    const url = `${window.location.origin}/${professional?.slug}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const initials = professional?.name
    ? professional.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* ── Overlay mobile ── */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-100
        flex flex-col transition-transform duration-300 ease-in-out
        lg:static lg:translate-x-0 lg:z-auto
        ${open ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-gray-100">
          <span className="text-xl font-bold text-[#2E75B6]">AgendaPRO</span>
          <button
            onClick={() => setOpen(false)}
            className="lg:hidden p-1 text-gray-400 hover:text-gray-600"
          >
            {Icons.close}
          </button>
        </div>

        {/* Navegação */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {navItems.map(({ path, label, icon, exact, badge }) => (
            <NavLink
              key={path}
              to={path}
              end={exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                 transition-colors relative group
                 ${isActive
                   ? 'bg-[#2E75B6]/10 text-[#2E75B6]'
                   : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                 }`
              }
            >
              {icon}
              <span className="flex-1">{label}</span>
              {/* Badge de atenção */}
              {!!badge && (
                <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center
                                 rounded-full bg-red-500 text-white text-xs font-bold">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Rodapé: info do profissional + logout */}
        <div className="border-t border-gray-100 p-4 space-y-3">
          {/* Avatar + nome */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#2E75B6] flex items-center justify-center
                            text-white text-sm font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{professional?.name}</p>
              <p className="text-xs text-gray-400 truncate">{professional?.email}</p>
            </div>
          </div>

          {/* Botão copiar link público */}
          <button
            onClick={handleCopyUrl}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-500
                       rounded-lg border border-gray-200 hover:border-[#2E75B6] hover:text-[#2E75B6]
                       transition-colors"
          >
            {Icons.link}
            <span className="flex-1 text-left truncate">
              {copied ? 'Link copiado!' : `/${professional?.slug}`}
            </span>
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-500
                       rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            {Icons.logout}
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* ── Conteúdo principal ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar mobile */}
        <header className="lg:hidden flex items-center gap-3 h-14 px-4 bg-white border-b border-gray-100">
          <button
            onClick={() => setOpen(true)}
            className="p-1.5 text-gray-600 hover:text-gray-800"
          >
            {Icons.menu}
          </button>
          <span className="text-base font-bold text-[#2E75B6]">AgendaPRO</span>
          <div className="flex-1" />
          {/* Badge de pendentes no header mobile */}
          {pendingTotal > 0 && (
            <span className="w-5 h-5 flex items-center justify-center rounded-full
                             bg-red-500 text-white text-xs font-bold">
              {pendingTotal > 9 ? '9+' : pendingTotal}
            </span>
          )}
        </header>

        {/* Área de rolagem do conteúdo */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
