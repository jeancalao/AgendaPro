// Página de perfil do cliente — header, abas Histórico e Estatísticas
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useClientProfile,
  useUpdateClient,
  useDeleteClient,
  type ClientAppointment,
} from '../../hooks/useClients';
import { StatusBadge } from '../../components/dashboard/StatusBadge';

// ─── Utilitários ──────────────────────────────────────────────────────────────
function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function avatarColor(name: string): string {
  const colors = ['#2E75B6','#16a34a','#9333ea','#ea580c','#0891b2','#be185d','#d97706'];
  const idx = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;
  return colors[idx];
}

function formatPhone(phone: string): string {
  // Remove não-dígitos e formata como link wa.me
  return phone.replace(/\D/g, '');
}

// ─── Ícones inline ────────────────────────────────────────────────────────────
const Icons = {
  back:      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>,
  edit:      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>,
  check:     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>,
  x:         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>,
  whatsapp:  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>,
  calendar:  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>,
  trash:     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>,
};

// ─── Campo editável inline ─────────────────────────────────────────────────────
interface InlineFieldProps {
  label:     string;
  value:     string;
  onSave:    (v: string) => void;
  type?:     string;
  multiline?: boolean;
}

function InlineField({ label, value, onSave, type = 'text', multiline = false }: InlineFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(value);

  function handleSave() {
    onSave(draft);
    setEditing(false);
  }

  function handleCancel() {
    setDraft(value);
    setEditing(false);
  }

  return (
    <div>
      <p className="text-xs text-gray-400 uppercase font-medium mb-1">{label}</p>
      {editing ? (
        <div className="flex gap-2 items-start">
          {multiline ? (
            <textarea
              className="flex-1 border border-[#2E75B6]/40 rounded-lg px-3 py-1.5 text-sm
                         resize-none focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/30"
              rows={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
            />
          ) : (
            <input
              type={type}
              className="flex-1 border border-[#2E75B6]/40 rounded-lg px-3 py-1.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/30"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
            />
          )}
          <button
            onClick={handleSave}
            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
          >{Icons.check}</button>
          <button
            onClick={handleCancel}
            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
          >{Icons.x}</button>
        </div>
      ) : (
        <button
          onClick={() => { setDraft(value); setEditing(true); }}
          className="flex items-center gap-2 text-sm text-gray-700 hover:text-[#2E75B6]
                     group transition-colors text-left w-full"
        >
          <span className={value ? '' : 'text-gray-400 italic'}>
            {value || 'Não informado'}
          </span>
          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400">
            {Icons.edit}
          </span>
        </button>
      )}
    </div>
  );
}

// ─── Aba Histórico ────────────────────────────────────────────────────────────
interface HistoryTabProps { appointments: ClientAppointment[] }

function HistoryTab({ appointments }: HistoryTabProps) {
  if (appointments.length === 0) {
    return (
      <div className="py-16 text-center text-gray-400 text-sm">
        Nenhuma sessão registrada ainda.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {appointments.map((appt) => (
        <div
          key={appt.id}
          className="bg-white rounded-xl border border-gray-100 p-4 flex gap-4 items-center shadow-sm"
        >
          {/* Barra colorida */}
          <div
            className="w-1 self-stretch rounded-full flex-shrink-0"
            style={{ backgroundColor: appt.service.color }}
          />
          {/* Data */}
          <div className="text-center w-14 flex-shrink-0">
            <p className="text-sm font-bold text-gray-800 tabular-nums">
              {format(parseISO(appt.startDateTime), 'dd/MM', { locale: ptBR })}
            </p>
            <p className="text-xs text-gray-400">
              {format(parseISO(appt.startDateTime), 'yyyy')}
            </p>
          </div>
          {/* Horário e serviço */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800">{appt.service.name}</p>
            <p className="text-xs text-gray-400 tabular-nums">
              {format(parseISO(appt.startDateTime), 'HH:mm')}
              {' – '}
              {format(parseISO(appt.endDateTime), 'HH:mm')}
              {' · '}
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(appt.service.price)}
            </p>
            {appt.notes && (
              <p className="text-xs text-gray-500 mt-0.5 truncate">{appt.notes}</p>
            )}
            {appt.cancelReason && (
              <p className="text-xs text-red-400 mt-0.5">Motivo: {appt.cancelReason}</p>
            )}
          </div>
          {/* Status */}
          <StatusBadge status={appt.status as never} />
        </div>
      ))}
    </div>
  );
}

// ─── Aba Estatísticas ─────────────────────────────────────────────────────────
interface StatsTabProps {
  stats: {
    totalSessions:     number;
    completedSessions: number;
    cancelledSessions: number;
    noShowSessions:    number;
    attendanceRate:    number;
    cancellationRate:  number;
    totalRevenue:      number;
  };
}

function StatsTab({ stats }: StatsTabProps) {
  const revenue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(stats.totalRevenue);

  const cards = [
    { label: 'Total de sessões',   value: stats.totalSessions,     color: 'bg-blue-50 text-[#2E75B6]' },
    { label: 'Sessões concluídas', value: stats.completedSessions, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Cancelamentos',      value: stats.cancelledSessions, color: 'bg-red-50 text-red-500' },
    { label: 'Não compareceu',     value: stats.noShowSessions,    color: 'bg-gray-100 text-gray-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Cards numéricos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {cards.map(({ label, value, color }) => (
          <div key={label} className={`rounded-xl p-4 ${color.split(' ')[0]}`}>
            <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
            <p className={`text-2xl font-bold tabular-nums ${color.split(' ')[1]}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Receita */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <p className="text-xs text-gray-400 uppercase font-medium mb-2">Receita gerada</p>
        <p className="text-3xl font-bold text-gray-800">{revenue}</p>
        <p className="text-xs text-gray-400 mt-1">apenas sessões concluídas</p>
      </div>

      {/* Taxas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Taxa de presença */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-xs text-gray-400 uppercase font-medium mb-3">Taxa de presença</p>
          <div className="flex items-end gap-3">
            <p className="text-3xl font-bold text-emerald-600">{stats.attendanceRate}%</p>
          </div>
          <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${stats.attendanceRate}%` }}
            />
          </div>
        </div>

        {/* Taxa de cancelamento */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-xs text-gray-400 uppercase font-medium mb-3">Taxa de cancelamento</p>
          <div className="flex items-end gap-3">
            <p className="text-3xl font-bold text-red-500">{stats.cancellationRate}%</p>
          </div>
          <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-400 rounded-full transition-all"
              style={{ width: `${stats.cancellationRate}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Modal de confirmação de exclusão ─────────────────────────────────────────
interface DeleteModalProps { name: string; onConfirm: () => void; onClose: () => void; loading: boolean }

function DeleteModal({ name, onConfirm, onClose, loading }: DeleteModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-5 space-y-4">
        <h3 className="font-semibold text-gray-800">Remover cliente</h3>
        <p className="text-sm text-gray-500">
          Tem certeza que deseja remover{' '}
          <span className="font-medium text-gray-700">{name}</span>? Esta ação pode ser desfeita
          recriando o cliente com o mesmo e-mail.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 bg-red-600 text-white text-sm font-semibold
                       rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Removendo...' : 'Remover'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-gray-200 text-sm text-gray-600
                       rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ClientProfilePage ────────────────────────────────────────────────────────
type TabKey = 'history' | 'stats';

export function ClientProfilePage() {
  const { id }    = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const [tab, setTab]             = useState<TabKey>('history');
  const [showDelete, setShowDelete] = useState(false);

  const { data: client, isLoading, error } = useClientProfile(id);
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-3xl mx-auto animate-pulse">
        <div className="h-8 w-32 bg-gray-200 rounded" />
        <div className="h-24 bg-white rounded-xl border border-gray-100" />
        <div className="h-64 bg-white rounded-xl border border-gray-100" />
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="p-6 text-center text-gray-400 text-sm">
        Cliente não encontrado.{' '}
        <button
          onClick={() => navigate('/dashboard/clients')}
          className="text-[#2E75B6] hover:underline"
        >
          Voltar
        </button>
      </div>
    );
  }

  const bg = avatarColor(client.name);

  function handleUpdate(field: 'name' | 'email' | 'phone' | 'notes', value: string) {
    updateClient.mutate({
      id:     client!.id,
      [field]: value || null,
    });
  }

  function handleDelete() {
    deleteClient.mutate(client!.id, {
      onSuccess: () => navigate('/dashboard/clients'),
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        alert(msg ?? 'Erro ao remover cliente.');
        setShowDelete(false);
      },
    });
  }

  const whatsappUrl = client.phone
    ? `https://wa.me/55${formatPhone(client.phone)}`
    : null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-3xl mx-auto">
      {/* ── Voltar ── */}
      <button
        onClick={() => navigate('/dashboard/clients')}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors"
      >
        {Icons.back} Clientes
      </button>

      {/* ── Header do perfil ── */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center
                       text-white text-xl font-bold flex-shrink-0"
            style={{ backgroundColor: bg }}
          >
            {initials(client.name)}
          </div>

          {/* Dados editáveis */}
          <div className="flex-1 min-w-0 space-y-3">
            <InlineField
              label="Nome"
              value={client.name}
              onSave={(v) => handleUpdate('name', v)}
            />
            <InlineField
              label="E-mail"
              value={client.email}
              onSave={(v) => handleUpdate('email', v)}
              type="email"
            />
            <InlineField
              label="WhatsApp"
              value={client.phone ?? ''}
              onSave={(v) => handleUpdate('phone', v)}
              type="tel"
            />
            <InlineField
              label="Observações"
              value={client.notes ?? ''}
              onSave={(v) => handleUpdate('notes', v)}
              multiline
            />

            <p className="text-xs text-gray-400">
              Cliente desde {format(parseISO(client.createdAt), "MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
        </div>

        {/* Ações */}
        <div className="mt-4 pt-4 border-t border-gray-50 flex gap-2 flex-wrap">
          {/* Agendar para este cliente */}
          <button
            onClick={() => navigate(`/dashboard/calendar?clientId=${client.id}`)}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-white
                       bg-[#2E75B6] rounded-lg hover:bg-[#2563a8] transition-colors"
          >
            {Icons.calendar}
            Agendar
          </button>

          {/* WhatsApp */}
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold
                         text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
            >
              {Icons.whatsapp}
              Enviar mensagem
            </a>
          )}

          {/* Remover */}
          <button
            onClick={() => setShowDelete(true)}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold
                       text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors ml-auto"
          >
            {Icons.trash}
            Remover
          </button>
        </div>
      </div>

      {/* ── Abas ── */}
      <div>
        <div className="flex gap-1 border-b border-gray-100 mb-4">
          {([
            { key: 'history', label: `Histórico (${client.appointments.length})` },
            { key: 'stats',   label: 'Estatísticas' },
          ] as { key: TabKey; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
                ${tab === key
                  ? 'border-[#2E75B6] text-[#2E75B6]'
                  : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'history'
          ? <HistoryTab appointments={client.appointments} />
          : <StatsTab   stats={client.stats} />
        }
      </div>

      {/* Modal exclusão */}
      {showDelete && (
        <DeleteModal
          name={client.name}
          onConfirm={handleDelete}
          onClose={() => setShowDelete(false)}
          loading={deleteClient.isPending}
        />
      )}
    </div>
  );
}
