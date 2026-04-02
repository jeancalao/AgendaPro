// Página de cadastro — com preview do link público
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const BASE_URL = 'agendapro.com.br';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate      = useNavigate();

  const [form, setForm]       = useState({ name: '', email: '', password: '', phone: '', slug: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  // Gera slug automático a partir do nome
  function slugify(value: string) {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')   // remove acentos
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((f) => {
      const next = { ...f, [name]: value };
      // Gera slug automaticamente quando o nome muda (se slug não foi editado manualmente)
      if (name === 'name' && !f.slug) {
        next.slug = slugify(value);
      }
      return next;
    });
    setError('');
  }

  function handleSlugChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((f) => ({ ...f, slug: slugify(e.target.value) }));
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.slug.length < 3) {
      setError('Link público deve ter ao menos 3 caracteres');
      return;
    }
    setLoading(true);
    try {
      await register(form);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <span className="text-3xl font-bold text-[#2E75B6]">AgendaPRO</span>
        </div>
        <h2 className="mt-6 text-center text-2xl font-semibold text-gray-800">
          Crie sua conta grátis
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm rounded-xl border border-gray-100">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <InputField id="name"     label="Nome completo"  name="name"     type="text"     value={form.name}     onChange={handleChange} placeholder="Dr. João Silva" />
            <InputField id="email"    label="E-mail"         name="email"    type="email"    value={form.email}    onChange={handleChange} placeholder="seu@email.com" />
            <InputField id="phone"    label="Telefone (opcional)" name="phone" type="tel"   value={form.phone}    onChange={handleChange} placeholder="(11) 99999-9999" />
            <InputField id="password" label="Senha"          name="password" type="password" value={form.password} onChange={handleChange} placeholder="Mín. 6 caracteres" />

            {/* Link público com preview */}
            <div>
              <label htmlFor="slug" className="block text-sm font-medium text-gray-700 mb-1">
                Link público
              </label>
              <input
                id="slug"
                name="slug"
                type="text"
                required
                value={form.slug}
                onChange={handleSlugChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900
                           focus:outline-none focus:ring-2 focus:ring-[#2E75B6] focus:border-transparent"
                placeholder="joao-silva"
              />
              {form.slug && (
                <p className="mt-1.5 text-xs text-gray-500">
                  Seu link:{' '}
                  <span className="font-medium text-[#2E75B6]">
                    {BASE_URL}/{form.slug}
                  </span>
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2.5 px-4 rounded-lg text-white font-medium
                         bg-[#2E75B6] hover:bg-[#255e99] transition-colors
                         disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Criando conta...' : 'Criar conta grátis'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Já tem conta?{' '}
            <Link to="/login" className="text-[#2E75B6] font-medium hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// Componente auxiliar de campo de input
function InputField({
  id, label, name, type, value, onChange, placeholder,
}: {
  id: string; label: string; name: string; type: string;
  value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        id={id} name={name} type={type} value={value}
        onChange={onChange} placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900
                   placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2E75B6]
                   focus:border-transparent"
      />
    </div>
  );
}
