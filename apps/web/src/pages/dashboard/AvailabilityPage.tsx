// Página de configuração de disponibilidade semanal
import { useState, useEffect } from 'react';
import { useAvailability, useSaveAvailability, AvailabilityEntry, DayOfWeek } from '../../hooks/useAvailability';

const DAYS: { key: DayOfWeek; label: string; short: string }[] = [
  { key: 'MONDAY',    label: 'Segunda-feira', short: 'Seg' },
  { key: 'TUESDAY',   label: 'Terça-feira',   short: 'Ter' },
  { key: 'WEDNESDAY', label: 'Quarta-feira',  short: 'Qua' },
  { key: 'THURSDAY',  label: 'Quinta-feira',  short: 'Qui' },
  { key: 'FRIDAY',    label: 'Sexta-feira',   short: 'Sex' },
  { key: 'SATURDAY',  label: 'Sábado',        short: 'Sáb' },
  { key: 'SUNDAY',    label: 'Domingo',       short: 'Dom' },
];

type WeekState = Record<DayOfWeek, { isActive: boolean; startTime: string; endTime: string }>;

function buildDefaultWeek(): WeekState {
  const result = {} as WeekState;
  for (const day of DAYS) {
    result[day.key] = { isActive: false, startTime: '09:00', endTime: '18:00' };
  }
  return result;
}

export function AvailabilityPage() {
  const { data: saved, isLoading } = useAvailability();
  const saveAvailability = useSaveAvailability();

  const [week, setWeek]         = useState<WeekState>(buildDefaultWeek);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Sincroniza dados do servidor com o estado local
  useEffect(() => {
    if (!saved) return;
    setWeek((prev) => {
      const next = { ...prev };
      for (const entry of saved) {
        next[entry.dayOfWeek as DayOfWeek] = {
          isActive:  entry.isActive,
          startTime: entry.startTime,
          endTime:   entry.endTime,
        };
      }
      return next;
    });
  }, [saved]);

  function toggleDay(day: DayOfWeek) {
    setWeek((w) => ({ ...w, [day]: { ...w[day], isActive: !w[day].isActive } }));
  }

  function updateTime(day: DayOfWeek, field: 'startTime' | 'endTime', value: string) {
    setWeek((w) => ({ ...w, [day]: { ...w[day], [field]: value } }));
  }

  async function handleSave() {
    setFeedback(null);

    // Valida startTime < endTime para dias ativos
    for (const day of DAYS) {
      const d = week[day.key];
      if (d.isActive && d.startTime >= d.endTime) {
        setFeedback({ type: 'error', msg: `${day.label}: horário de início deve ser anterior ao fim` });
        return;
      }
    }

    try {
      const payload = DAYS.map(({ key }) => ({ dayOfWeek: key, ...week[key] }));
      await saveAvailability.mutateAsync(payload);
      setFeedback({ type: 'success', msg: 'Disponibilidade salva com sucesso!' });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err.response?.data?.error || 'Erro ao salvar' });
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Disponibilidade</h1>
        <p className="text-sm text-gray-500 mt-0.5">Configure os dias e horários em que você atende</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2E75B6]" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Cabeçalho */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <span>Dia</span>
            <span>Início</span>
            <span>Fim</span>
            <span>Ativo</span>
          </div>

          {/* Linhas por dia */}
          {DAYS.map(({ key, label, short }) => {
            const d = week[key];
            return (
              <div
                key={key}
                className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-5 py-4 border-b border-gray-50 last:border-b-0 transition-colors ${
                  d.isActive ? '' : 'opacity-50'
                }`}
              >
                {/* Nome do dia */}
                <div>
                  <span className="hidden sm:block font-medium text-gray-700">{label}</span>
                  <span className="sm:hidden font-medium text-gray-700">{short}</span>
                </div>

                {/* Horário início */}
                <input
                  type="time"
                  value={d.startTime}
                  disabled={!d.isActive}
                  onChange={(e) => updateTime(key, 'startTime', e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-700
                             focus:outline-none focus:ring-2 focus:ring-[#2E75B6] disabled:bg-gray-50 disabled:cursor-not-allowed"
                />

                {/* Horário fim */}
                <input
                  type="time"
                  value={d.endTime}
                  disabled={!d.isActive}
                  onChange={(e) => updateTime(key, 'endTime', e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-700
                             focus:outline-none focus:ring-2 focus:ring-[#2E75B6] disabled:bg-gray-50 disabled:cursor-not-allowed"
                />

                {/* Toggle */}
                <button
                  type="button"
                  onClick={() => toggleDay(key)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    d.isActive ? 'bg-[#2E75B6]' : 'bg-gray-300'
                  }`}
                  aria-label={d.isActive ? `Desativar ${label}` : `Ativar ${label}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      d.isActive ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview dos dias ativos */}
      {!isLoading && (
        <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
          <p className="text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wide">Resumo da disponibilidade</p>
          <div className="flex flex-wrap gap-2">
            {DAYS.filter(({ key }) => week[key].isActive).length === 0 ? (
              <span className="text-sm text-blue-500">Nenhum dia ativo configurado</span>
            ) : (
              DAYS.filter(({ key }) => week[key].isActive).map(({ key, short }) => (
                <span key={key} className="inline-flex items-center gap-1.5 bg-white border border-blue-200 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full">
                  <span>{short}</span>
                  <span className="text-blue-400">{week[key].startTime}–{week[key].endTime}</span>
                </span>
              ))
            )}
          </div>
        </div>
      )}

      {/* Feedback */}
      {feedback && (
        <div className={`mt-4 px-4 py-3 rounded-lg text-sm ${
          feedback.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-700'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {feedback.msg}
        </div>
      )}

      {/* Botão salvar */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saveAvailability.isPending || isLoading}
          className="px-6 py-2.5 bg-[#2E75B6] text-white rounded-lg font-medium text-sm
                     hover:bg-[#255e99] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saveAvailability.isPending ? 'Salvando...' : 'Salvar disponibilidade'}
        </button>
      </div>
    </div>
  );
}
