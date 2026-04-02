// Página de clientes — lista com busca, toggle card/tabela e modal de criação
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useClients, useCreateClient, type Client } from '../../hooks/useClients';

// ─── Ícones inline ────────────────────────────────────────────────────────────
const Icons = {
  search: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>,
  grid:   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>,
  list:   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>,
  plus:   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>,
  phone:  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>,
  mail:   <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>,
  chevron: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>,
};

// ─── Utilitários ──────────────────────────────────────────────────────────────
function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function avatarColor(name: string): string {
  const colors = ['#2E75B6','#16a34a','#9333ea','#ea580c','#0891b2','#be185d','#d97706'];
  const idx = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;
  return colors[idx];
}

// ─── Modal de criação ─────────────────────────────────────────────────────────
interface CreateModalProps { onClose: () => void }

function CreateModal({ onClose }: CreateModalProps) {
  const createClient = useCreateClient();
  const [form, setForm] = useState({ name: '', email: '', phone: '', notes: '' });
  const [error, setError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  function set(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.name || !form.email) { setError('Nome e e-mail são obrigatórios.'); return; }
    try {
      await createClient.mutateAsync({
        name:  form.name,
        email: form.email,
        phone: form.phone || undefined,
        notes: form.notes || undefined,
      });
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Erro ao criar cliente.');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Novo Cliente</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
            <input
              ref={nameRef}
              type="text"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/30"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Maria Silva"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail *</label>
            <input
              type="email"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/30"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="maria@email.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
            <input
              type="tel"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/30"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="(11) 99999-9999"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <textarea
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none
                         focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/30"
              rows={3}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Alergias, preferências..."
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={createClient.isPending}
              className="flex-1 py-2.5 bg-[#2E75B6] text-white text-sm font-semibold
                         rounded-lg hover:bg-[#2563a8] disabled:opacity-50 transition-colors"
            >
              {createClient.isPending ? 'Criando...' : 'Criar Cliente'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-gray-200 text-sm text-gray-600
                         rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Card de cliente ──────────────────────────────────────────────────────────
interface ClientCardProps { client: Client; onClick: () => void }

function ClientCard({ client, onClick }: ClientCardProps) {
  const bg = avatarColor(client.name);
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-100 p-4 text-left w-full
                 hover:border-[#2E75B6]/30 hover:shadow-md transition-all group"
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center
                     text-white text-sm font-bold flex-shrink-0"
          style={{ backgroundColor: bg }}
        >
          {initials(client.name)}
        </div>
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-gray-800 truncate group-hover:text-[#2E75B6] transition-colors">
              {client.name}
            </p>
            <span className="text-gray-300 group-hover:text-[#2E75B6] flex-shrink-0 transition-colors">
              {Icons.chevron}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-400">
            {Icons.mail}<span className="truncate">{client.email}</span>
          </div>
          {client.phone && (
            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-400">
              {Icons.phone}<span>{client.phone}</span>
            </div>
          )}
        </div>
      </div>
      {/* Rodapé do card */}
      <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between text-xs text-gray-400">
        <span>
          {client.totalAppointments} sessão{client.totalAppointments !== 1 ? 'ões' : ''}
        </span>
        {client.lastAppointment ? (
          <span>
            Última: {format(parseISO(client.lastAppointment.startDateTime), 'dd/MM/yyyy', { locale: ptBR })}
          </span>
        ) : (
          <span>Sem sessões</span>
        )}
      </div>
    </button>
  );
}

// ─── Linha de tabela ──────────────────────────────────────────────────────────
interface ClientRowProps { client: Client; onClick: () => void }

function ClientRow({ client, onClick }: ClientRowProps) {
  const bg = avatarColor(client.name);
  return (
    <tr
      onClick={onClick}
      className="hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-50 last:border-0"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center
                       text-white text-xs font-bold flex-shrink-0"
            style={{ backgroundColor: bg }}
          >
            {initials(client.name)}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800 hover:text-[#2E75B6]">{client.name}</p>
            <p className="text-xs text-gray-400">{client.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">{client.phone ?? '—'}</td>
      <td className="px-4 py-3 text-sm text-gray-500 tabular-nums text-center">
        {client.totalAppointments}
      </td>
      <td className="px-4 py-3 text-sm text-gray-400 tabular-nums">
        {client.lastAppointment
          ? format(parseISO(client.lastAppointment.startDateTime), 'dd/MM/yyyy', { locale: ptBR })
          : '—'}
      </td>
      <td className="px-4 py-3">
        <span className="text-gray-300">{Icons.chevron}</span>
      </td>
    </tr>
  );
}

// ─── ClientsPage ──────────────────────────────────────────────────────────────
export function ClientsPage() {
  const navigate = useNavigate();
  const [search,    setSearch]    = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [viewMode,  setViewMode]  = useState<'grid' | 'list'>('grid');
  const [page,      setPage]      = useState(1);
  const [showModal, setShowModal] = useState(false);

  // Debounce de busca 300ms
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isFetching } = useClients({
    q: debouncedQ || undefined,
    page,
    limit: 20,
  });

  const clients    = data?.data       ?? [];
  const total      = data?.meta.total ?? 0;
  const totalPages = data?.meta.totalPages ?? 1;

  function goToClient(id: string) {
    navigate(`/dashboard/clients/${id}`);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-5xl mx-auto">
      {/* ── Cabeçalho ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Clientes</h1>
          {!isLoading && (
            <p className="text-sm text-gray-400 mt-0.5">
              {total} cliente{total !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#2E75B6] text-white
                     text-sm font-semibold rounded-lg hover:bg-[#2563a8] transition-colors"
        >
          {Icons.plus}
          Novo Cliente
        </button>
      </div>

      {/* ── Barra de busca + toggle ── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            {Icons.search}
          </span>
          <input
            type="text"
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm
                       focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/30 bg-white"
            placeholder="Buscar por nome, e-mail ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {isFetching && !isLoading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-[#2E75B6] border-t-transparent rounded-full animate-spin" />
            </span>
          )}
        </div>

        {/* Toggle card/tabela */}
        <div className="flex bg-gray-100 rounded-lg p-0.5 flex-shrink-0">
          {(['grid', 'list'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`p-2 rounded-md transition-colors
                ${viewMode === mode
                  ? 'bg-white text-gray-700 shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'}`}
            >
              {mode === 'grid' ? Icons.grid : Icons.list}
            </button>
          ))}
        </div>
      </div>

      {/* ── Conteúdo ── */}
      {isLoading ? (
        <div className={viewMode === 'grid'
          ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
          : 'space-y-2'
        }>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 bg-white rounded-xl border border-gray-100 animate-pulse" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-16 text-center">
          <p className="text-gray-400 text-sm">
            {debouncedQ
              ? `Nenhum cliente encontrado para "${debouncedQ}"`
              : 'Nenhum cliente ainda. Crie o primeiro!'}
          </p>
          {!debouncedQ && (
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 px-4 py-2 bg-[#2E75B6] text-white text-sm font-semibold
                         rounded-lg hover:bg-[#2563a8] transition-colors"
            >
              Criar cliente
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((c) => (
            <ClientCard key={c.id} client={c} onClick={() => goToClient(c.id)} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Telefone</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">Sessões</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Última sessão</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <ClientRow key={c.id} client={c} onClick={() => goToClient(c.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Paginação ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">Página {page} de {totalPages}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600
                         hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600
                         hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      {/* Modal criação */}
      {showModal && <CreateModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
