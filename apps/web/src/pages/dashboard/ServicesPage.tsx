// Página de gerenciamento de serviços do profissional
import { useState } from 'react';
import {
  useServices, useCreateService, useUpdateService,
  useDeleteService, useToggleService, Service, ServiceInput,
} from '../../hooks/useServices';

const COLORS = [
  { hex: '#2E75B6', label: 'Azul'    },
  { hex: '#E74C3C', label: 'Vermelho'},
  { hex: '#2ECC71', label: 'Verde'   },
  { hex: '#F39C12', label: 'Laranja' },
  { hex: '#9B59B6', label: 'Roxo'    },
  { hex: '#1ABC9C', label: 'Teal'    },
];

const DEFAULT_FORM: ServiceInput = {
  name: '', description: '', durationMinutes: 60, price: 0, color: '#2E75B6',
};

export function ServicesPage() {
  const { data: services, isLoading } = useServices();
  const createService = useCreateService();
  const updateService = useUpdateService();
  const deleteService = useDeleteService();
  const toggleService = useToggleService();

  const [showModal, setShowModal]     = useState(false);
  const [editing, setEditing]         = useState<Service | null>(null);
  const [form, setForm]               = useState<ServiceInput>(DEFAULT_FORM);
  const [formError, setFormError]     = useState('');

  function openCreate() {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setFormError('');
    setShowModal(true);
  }

  function openEdit(service: Service) {
    setEditing(service);
    setForm({
      name:            service.name,
      description:     service.description || '',
      durationMinutes: Number(service.durationMinutes),
      price:           Number(service.price),
      color:           service.color,
    });
    setFormError('');
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    try {
      if (editing) {
        await updateService.mutateAsync({ id: editing.id, ...form });
      } else {
        await createService.mutateAsync(form);
      }
      setShowModal(false);
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Erro ao salvar serviço');
    }
  }

  const isSaving = createService.isPending || updateService.isPending;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meus Serviços</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gerencie os serviços oferecidos aos seus clientes</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-[#2E75B6] text-white px-4 py-2 rounded-lg
                     hover:bg-[#255e99] transition-colors text-sm font-medium"
        >
          <span className="text-lg leading-none">+</span>
          Novo Serviço
        </button>
      </div>

      {/* Estado de carregamento */}
      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2E75B6]" />
        </div>
      )}

      {/* Estado vazio */}
      {!isLoading && (!services || services.length === 0) && (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="text-lg font-medium text-gray-700 mb-2">Nenhum serviço cadastrado</h3>
          <p className="text-sm text-gray-400 mb-6">Adicione seus serviços para começar a receber agendamentos</p>
          <button
            onClick={openCreate}
            className="bg-[#2E75B6] text-white px-6 py-2.5 rounded-lg hover:bg-[#255e99] transition-colors text-sm font-medium"
          >
            Adicionar primeiro serviço
          </button>
        </div>
      )}

      {/* Lista de serviços */}
      {!isLoading && services && services.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {services.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onEdit={openEdit}
              onDelete={() => {
                if (confirm(`Desativar "${service.name}"?`)) {
                  deleteService.mutate(service.id);
                }
              }}
              onToggle={() => toggleService.mutate(service.id)}
            />
          ))}
        </div>
      )}

      {/* Modal de criação/edição */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">
                {editing ? 'Editar Serviço' : 'Novo Serviço'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                  {formError}
                </div>
              )}

              <FormField label="Nome do serviço *">
                <input
                  required value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Consulta Inicial"
                  className="input-base"
                />
              </FormField>

              <FormField label="Descrição">
                <textarea
                  value={form.description} rows={2}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Descreva o serviço brevemente..."
                  className="input-base resize-none"
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Duração (min) *">
                  <input
                    required type="number" min={15} max={480} step={5}
                    value={form.durationMinutes}
                    onChange={(e) => setForm((f) => ({ ...f, durationMinutes: Number(e.target.value) }))}
                    className="input-base"
                  />
                </FormField>

                <FormField label="Preço (R$) *">
                  <input
                    required type="number" min={0} max={99999} step={0.01}
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))}
                    className="input-base"
                  />
                </FormField>
              </div>

              <FormField label="Cor no calendário">
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((c) => (
                    <button
                      key={c.hex} type="button"
                      onClick={() => setForm((f) => ({ ...f, color: c.hex }))}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        form.color === c.hex ? 'border-gray-800 scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.label}
                    />
                  ))}
                </div>
              </FormField>

              <div className="flex gap-3 pt-2">
                <button
                  type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit" disabled={isSaving}
                  className="flex-1 py-2.5 rounded-lg bg-[#2E75B6] text-white text-sm font-medium
                             hover:bg-[#255e99] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componentes auxiliares ────────────────────────────────────────────────────

function ServiceCard({ service, onEdit, onDelete, onToggle }: {
  service: Service;
  onEdit:   (s: Service) => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  return (
    <div className={`bg-white rounded-xl border p-4 shadow-sm ${!service.isActive ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: service.color }} />
          <h3 className="font-semibold text-gray-800">{service.name}</h3>
        </div>
        {/* Toggle ativo/inativo */}
        <button
          onClick={onToggle}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            service.isActive ? 'bg-[#2E75B6]' : 'bg-gray-300'
          }`}
          title={service.isActive ? 'Desativar' : 'Ativar'}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              service.isActive ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {service.description && (
        <p className="text-sm text-gray-500 mb-3 line-clamp-2">{service.description}</p>
      )}

      <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
        <span>⏱ {service.durationMinutes} min</span>
        <span>R$ {Number(service.price).toFixed(2).replace('.', ',')}</span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onEdit(service)}
          className="flex-1 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Editar
        </button>
        <button
          onClick={onDelete}
          className="px-3 py-1.5 text-sm border border-red-200 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
        >
          Remover
        </button>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
