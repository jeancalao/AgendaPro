// Página pública de agendamento — wizard 4 etapas
// URL: /:slug (ex: agendapro.com.br/joao-silva)
import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  format, addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  isSameMonth, isSameDay, isBefore, startOfDay, addMonths, subMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  usePublicProfile, usePublicSlots, useCreateBooking,
  PublicService, TimeSlot, BookingResult, DayOfWeek,
} from '../../hooks/usePublicBooking';

// Mapeamento: enum DayOfWeek → getDay() (0 = domingo)
const DAY_MAP: Record<DayOfWeek, number> = {
  SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3,
  THURSDAY: 4, FRIDAY: 5, SATURDAY: 6,
};

type Step = 1 | 2 | 3 | 4;

// ─────────────────────────────────────────────────────────────────────────────
// BookingPage
// ─────────────────────────────────────────────────────────────────────────────
export function BookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: profile, isLoading, isError } = usePublicProfile(slug!);

  const [step, setStep]                       = useState<Step>(1);
  const [selectedService, setSelectedService] = useState<PublicService | null>(null);
  const [selectedDate, setSelectedDate]       = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot]       = useState<TimeSlot | null>(null);
  const [confirmation, setConfirmation]       = useState<BookingResult | null>(null);

  // ── Estado de carregamento ──
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[--brand]" />
      </div>
    );
  }

  // ── Profissional não encontrado ──
  if (isError || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="text-6xl mb-4">🔍</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Página não encontrada</h1>
        <p className="text-gray-500 text-center max-w-sm">
          O profissional que você está procurando não existe ou está temporariamente inativo.
        </p>
      </div>
    );
  }

  const { professional, services, availableDays } = profile;

  return (
    // CSS custom property para a cor da marca (personalizável no futuro)
    <div style={{ '--brand': '#2E75B6', '--brand-dark': '#255e99' } as React.CSSProperties}
      className="min-h-screen bg-gray-50">

      {/* Header do profissional */}
      <ProfessionalHeader
        name={professional.name}
        bio={professional.bio}
        avatarUrl={professional.avatarUrl}
      />

      {/* Wizard */}
      <div className="max-w-lg mx-auto px-4 pb-16">
        {/* Breadcrumb de etapas */}
        <StepsBreadcrumb currentStep={step} />

        {/* Etapas */}
        {step === 1 && (
          <Step1Services
            services={services}
            onSelect={(svc) => { setSelectedService(svc); setStep(2); }}
          />
        )}

        {step === 2 && selectedService && (
          <Step2DateTime
            slug={slug!}
            service={selectedService}
            availableDays={availableDays}
            selectedDate={selectedDate}
            selectedSlot={selectedSlot}
            onDateSelect={(d) => { setSelectedDate(d); setSelectedSlot(null); }}
            onSlotSelect={(slot) => { setSelectedSlot(slot); setStep(3); }}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && selectedService && selectedDate && selectedSlot && (
          <Step3ClientInfo
            slug={slug!}
            service={selectedService}
            date={selectedDate}
            slot={selectedSlot}
            onConfirm={(result) => { setConfirmation(result); setStep(4); }}
            onBack={() => setStep(2)}
          />
        )}

        {step === 4 && confirmation && selectedService && selectedDate && selectedSlot && (
          <Step4Confirmation
            result={confirmation}
            onBookAgain={() => {
              setStep(1);
              setSelectedService(null);
              setSelectedDate(null);
              setSelectedSlot(null);
              setConfirmation(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ProfessionalHeader
// ─────────────────────────────────────────────────────────────────────────────
function ProfessionalHeader({ name, bio, avatarUrl }: {
  name: string; bio?: string; avatarUrl?: string;
}) {
  return (
    <div className="bg-[--brand] text-white py-8 px-4 mb-6">
      <div className="max-w-lg mx-auto flex items-center gap-4">
        {/* Avatar */}
        {avatarUrl ? (
          <img src={avatarUrl} alt={name}
            className="w-16 h-16 rounded-full object-cover border-2 border-white/30 flex-shrink-0" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center
                          text-2xl font-bold flex-shrink-0">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold">{name}</h1>
          {bio && <p className="text-sm text-white/80 mt-0.5 line-clamp-2">{bio}</p>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StepsBreadcrumb
// ─────────────────────────────────────────────────────────────────────────────
function StepsBreadcrumb({ currentStep }: { currentStep: Step }) {
  const steps = [
    { n: 1 as Step, label: 'Serviço' },
    { n: 2 as Step, label: 'Data e horário' },
    { n: 3 as Step, label: 'Seus dados' },
  ];

  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map(({ n, label }, i) => {
        const done    = currentStep > n;
        const active  = currentStep === n;
        const pending = currentStep < n;
        return (
          <div key={n} className="flex items-center">
            {/* Linha conectora */}
            {i > 0 && (
              <div className={`h-0.5 w-8 sm:w-12 transition-colors ${done ? 'bg-[--brand]' : 'bg-gray-200'}`} />
            )}
            {/* Passo */}
            <div className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                transition-all
                ${done    ? 'bg-[--brand] text-white' : ''}
                ${active  ? 'bg-[--brand] text-white ring-4 ring-[--brand]/20' : ''}
                ${pending ? 'bg-gray-200 text-gray-400' : ''}`}>
                {done ? '✓' : n}
              </div>
              <span className={`text-xs hidden sm:block ${active ? 'text-[--brand] font-medium' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Etapa 1 — Seleção de Serviço
// ─────────────────────────────────────────────────────────────────────────────
function Step1Services({ services, onSelect }: {
  services: PublicService[];
  onSelect: (s: PublicService) => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Escolha o serviço</h2>

      {services.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          Nenhum serviço disponível no momento.
        </div>
      )}

      <div className="space-y-3">
        {services.map((svc) => (
          <button
            key={svc.id}
            onClick={() => onSelect(svc)}
            className="w-full bg-white border border-gray-200 rounded-xl p-4 text-left
                       hover:border-[--brand] hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-3">
              {/* Indicador de cor */}
              <span className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: svc.color }} />

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-gray-800 group-hover:text-[--brand] transition-colors">
                    {svc.name}
                  </span>
                  <span className="font-bold text-[--brand] text-sm flex-shrink-0">
                    R$ {Number(svc.price).toFixed(2).replace('.', ',')}
                  </span>
                </div>
                {svc.description && (
                  <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{svc.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">⏱ {svc.durationMinutes} minutos</p>
              </div>

              {/* Seta */}
              <svg className="w-5 h-5 text-gray-300 group-hover:text-[--brand] flex-shrink-0 transition-colors"
                fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Etapa 2 — Calendário + Horários
// ─────────────────────────────────────────────────────────────────────────────
function Step2DateTime({ slug, service, availableDays, selectedDate, selectedSlot,
  onDateSelect, onSlotSelect, onBack }: {
  slug:          string;
  service:       PublicService;
  availableDays: DayOfWeek[];
  selectedDate:  Date | null;
  selectedSlot:  TimeSlot | null;
  onDateSelect:  (d: Date) => void;
  onSlotSelect:  (s: TimeSlot) => void;
  onBack:        () => void;
}) {
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
  const { data: slots, isLoading: loadingSlots } = usePublicSlots(slug, service.id, dateStr);

  // Conjunto de weekdays com disponibilidade (para highlight no calendário)
  const availableWeekdays = useMemo(
    () => new Set(availableDays.map((d) => DAY_MAP[d])),
    [availableDays]
  );

  const today  = startOfDay(new Date());
  const maxDay = addDays(today, 60);

  return (
    <div>
      <button onClick={onBack}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-5 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Voltar
      </button>

      {/* Serviço selecionado (contexto) */}
      <div className="flex items-center gap-2 mb-5 px-3 py-2 bg-blue-50 rounded-lg border border-blue-100">
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: service.color }} />
        <span className="text-sm text-gray-700 font-medium">{service.name}</span>
        <span className="text-sm text-gray-400 ml-auto">{service.durationMinutes} min</span>
      </div>

      <h2 className="text-lg font-semibold text-gray-800 mb-4">Escolha a data</h2>

      {/* Calendário */}
      <MonthCalendar
        month={calendarMonth}
        selectedDate={selectedDate}
        availableWeekdays={availableWeekdays}
        today={today}
        maxDay={maxDay}
        onSelectDate={onDateSelect}
        onPrevMonth={() => setCalendarMonth((m) => subMonths(m, 1))}
        onNextMonth={() => setCalendarMonth((m) => addMonths(m, 1))}
      />

      {/* Slots */}
      {selectedDate && (
        <div className="mt-6">
          <h3 className="text-base font-semibold text-gray-800 mb-3">
            Horários disponíveis em{' '}
            <span className="text-[--brand]">
              {format(selectedDate, "d 'de' MMMM", { locale: ptBR })}
            </span>
          </h3>

          {loadingSlots ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-[--brand]" />
            </div>
          ) : !slots || slots.length === 0 ? (
            <div className="text-center py-8 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
              <p className="text-sm">Nenhum horário disponível nesse dia.</p>
              <p className="text-xs mt-1">Tente outra data.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {slots.map((slot) => (
                <button
                  key={slot.startTime}
                  disabled={!slot.available}
                  onClick={() => onSlotSelect(slot)}
                  className={`py-2.5 rounded-lg text-sm font-medium text-center transition-all
                    ${slot.available
                      ? 'bg-white border border-gray-200 text-gray-700 hover:border-[--brand] hover:text-[--brand] hover:shadow-sm'
                      : 'bg-gray-50 border border-gray-100 text-gray-300 cursor-not-allowed line-through'
                    }`}
                >
                  {slot.startTime}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Calendário Mensal
// ─────────────────────────────────────────────────────────────────────────────
function MonthCalendar({ month, selectedDate, availableWeekdays, today, maxDay,
  onSelectDate, onPrevMonth, onNextMonth }: {
  month:              Date;
  selectedDate:       Date | null;
  availableWeekdays:  Set<number>;
  today:              Date;
  maxDay:             Date;
  onSelectDate:       (d: Date) => void;
  onPrevMonth:        () => void;
  onNextMonth:        () => void;
}) {
  // Gera a grade do calendário: começa na segunda-feira da semana do 1º do mês
  const calDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 }); // segunda
    const end   = endOfWeek(endOfMonth(month),     { weekStartsOn: 1 });
    const days: Date[] = [];
    let d = start;
    while (d <= end) { days.push(d); d = addDays(d, 1); }
    return days;
  }, [month]);

  const canGoPrev = isBefore(today, startOfMonth(month)); // não vai antes do mês atual
  const canGoNext = isBefore(addMonths(month, -1), addDays(maxDay, -30));

  const WEEK_HEADERS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      {/* Navegação do mês */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onPrevMonth}
          disabled={!canGoPrev}
          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <span className="text-sm font-semibold text-gray-800 capitalize">
          {format(month, 'MMMM yyyy', { locale: ptBR })}
        </span>

        <button
          onClick={onNextMonth}
          disabled={!canGoNext}
          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Cabeçalho dos dias da semana */}
      <div className="grid grid-cols-7 mb-2">
        {WEEK_HEADERS.map((h) => (
          <div key={h} className="text-center text-xs font-medium text-gray-400 py-1">{h}</div>
        ))}
      </div>

      {/* Grade de dias */}
      <div className="grid grid-cols-7 gap-y-1">
        {calDays.map((day, i) => {
          const inMonth      = isSameMonth(day, month);
          const isPast       = isBefore(day, today);
          const isBeyondMax  = isBefore(maxDay, day);
          const isToday      = isSameDay(day, today);
          const isSelected   = selectedDate ? isSameDay(day, selectedDate) : false;
          const hasAvail     = availableWeekdays.has(day.getDay());
          const isDisabled   = !inMonth || isPast || isBeyondMax || !hasAvail;

          return (
            <div key={i} className="flex justify-center">
              <button
                onClick={() => !isDisabled && onSelectDate(startOfDay(day))}
                disabled={isDisabled}
                className={`
                  w-9 h-9 rounded-full text-sm font-medium flex items-center justify-center
                  transition-all relative
                  ${isSelected
                    ? 'bg-[--brand] text-white shadow-sm'
                    : isToday
                      ? 'border-2 border-[--brand] text-[--brand]'
                      : isDisabled
                        ? 'text-gray-200 cursor-not-allowed'
                        : hasAvail
                          ? 'text-gray-700 hover:bg-blue-50 hover:text-[--brand] cursor-pointer'
                          : 'text-gray-300 cursor-not-allowed'
                  }
                `}
              >
                {format(day, 'd')}
                {/* Ponto indicador de disponibilidade */}
                {!isDisabled && !isSelected && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1
                                   rounded-full bg-[--brand]" />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Etapa 3 — Dados do Cliente
// ─────────────────────────────────────────────────────────────────────────────
function Step3ClientInfo({ slug, service, date, slot, onConfirm, onBack }: {
  slug:      string;
  service:   PublicService;
  date:      Date;
  slot:      TimeSlot;
  onConfirm: (result: BookingResult) => void;
  onBack:    () => void;
}) {
  const createBooking = useCreateBooking(slug);

  const [form, setForm]   = useState({ name: '', email: '', phone: '' });
  const [error, setError] = useState('');

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const result = await createBooking.mutateAsync({
        serviceId:   service.id,
        date:        format(date, 'yyyy-MM-dd'),
        startTime:   slot.startTime,
        clientName:  form.name,
        clientEmail: form.email,
        clientPhone: form.phone,
      });
      onConfirm(result);
    } catch (err: any) {
      // Double booking: slot foi tomado durante o preenchimento
      const msg = err.response?.data?.error || 'Erro ao confirmar agendamento. Tente novamente.';
      setError(msg);
    }
  }

  return (
    <div>
      <button onClick={onBack}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-5 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Voltar
      </button>

      {/* Resumo do agendamento */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
        <h3 className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3">
          Resumo do agendamento
        </h3>
        <div className="space-y-2">
          <SummaryRow icon="📋" label="Serviço"  value={service.name} />
          <SummaryRow icon="📅" label="Data"
            value={format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })} />
          <SummaryRow icon="⏰" label="Horário"  value={`${slot.startTime} – ${slot.endTime}`} />
          <SummaryRow icon="⏱"  label="Duração"  value={`${service.durationMinutes} minutos`} />
          <SummaryRow icon="💰" label="Valor"
            value={`R$ ${Number(service.price).toFixed(2).replace('.', ',')}`} />
        </div>
      </div>

      {/* Formulário */}
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Seus dados</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4">
            <p className="font-medium">Atenção</p>
            <p className="mt-0.5">{error}</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nome completo *
          </label>
          <input
            name="name" type="text" required
            value={form.name} onChange={handleChange}
            placeholder="Maria da Silva"
            className="input-base"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            E-mail *
          </label>
          <input
            name="email" type="email" required
            value={form.email} onChange={handleChange}
            placeholder="seu@email.com"
            className="input-base"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            WhatsApp *
          </label>
          <input
            name="phone" type="tel" required
            value={form.phone} onChange={handleChange}
            placeholder="(11) 99999-9999"
            className="input-base"
          />
        </div>

        {/* Aviso de lembrete */}
        <p className="text-xs text-gray-400 text-center pt-1">
          Ao confirmar, você receberá um lembrete por e-mail e WhatsApp.
        </p>

        <button
          type="submit"
          disabled={createBooking.isPending}
          className="w-full py-3 rounded-xl text-white font-semibold text-base
                     bg-[--brand] hover:bg-[--brand-dark] transition-colors
                     disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {createBooking.isPending ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Confirmando...
            </span>
          ) : (
            'Confirmar Agendamento'
          )}
        </button>
      </form>
    </div>
  );
}

function SummaryRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-sm">{icon}</span>
      <span className="text-xs text-blue-600 font-medium w-16 flex-shrink-0">{label}</span>
      <span className="text-xs text-gray-700 capitalize">{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Etapa 4 — Confirmação
// ─────────────────────────────────────────────────────────────────────────────
function Step4Confirmation({ result, onBookAgain }: {
  result:      BookingResult;
  onBookAgain: () => void;
}) {
  const { appointment, confirmationCode, googleCalendarUrl } = result;

  const startDt = new Date(appointment.startDateTime);
  const endDt   = new Date(appointment.endDateTime);

  return (
    <div className="text-center">
      {/* Ícone de sucesso animado */}
      <div className="flex justify-center mb-6">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center
                        animate-[bounceIn_0.5s_ease-out]">
          <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-800 mb-2">Agendamento Confirmado!</h2>
      <p className="text-gray-500 text-sm mb-8">
        Você receberá um lembrete por e-mail e WhatsApp em breve.
      </p>

      {/* Código de confirmação */}
      <div className="bg-[--brand]/5 border-2 border-[--brand]/20 rounded-xl p-5 mb-6">
        <p className="text-xs font-semibold text-[--brand] uppercase tracking-widest mb-2">
          Código de confirmação
        </p>
        <p className="text-3xl font-bold text-gray-800 tracking-widest font-mono">
          {confirmationCode}
        </p>
      </div>

      {/* Resumo */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 text-left space-y-3 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Detalhes do agendamento</h3>
        <SummaryRow icon="📋" label="Serviço"     value={appointment.service.name} />
        <SummaryRow icon="👤" label="Profissional" value={appointment.professional.name} />
        <SummaryRow icon="📅" label="Data"
          value={format(startDt, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })} />
        <SummaryRow icon="⏰" label="Horário"
          value={`${format(startDt, 'HH:mm')} – ${format(endDt, 'HH:mm')}`} />
        <SummaryRow icon="💰" label="Valor"
          value={`R$ ${Number(appointment.service.price).toFixed(2).replace('.', ',')}`} />
      </div>

      {/* Ações */}
      <div className="space-y-3">
        <a
          href={googleCalendarUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2
                     border-[--brand] text-[--brand] font-semibold text-sm
                     hover:bg-[--brand]/5 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 3h-1V1h-2v2H8V1H6v2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm0 16H5V8h14v11zM7 10h5v5H7z" />
          </svg>
          Adicionar ao Google Agenda
        </a>

        <button
          onClick={onBookAgain}
          className="w-full py-3 rounded-xl text-gray-600 text-sm font-medium
                     hover:bg-gray-100 transition-colors"
        >
          Agendar outro horário
        </button>
      </div>
    </div>
  );
}
