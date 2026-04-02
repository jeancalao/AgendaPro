// Contexto de autenticação do AgendaPRO
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';

interface Professional {
  id: string;
  name: string;
  email: string;
  phone?: string;
  slug: string;
  bio?: string;
  avatarUrl?: string;
  timezone: string;
  subscriptionPlan: string;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  phone?: string;
  slug: string;
}

interface AuthContextType {
  professional: Professional | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
}

const TOKEN_KEY = 'agendapro:token';

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [token, setToken]               = useState<string | null>(localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading]       = useState(true);

  // Carrega o profissional ao iniciar (se houver token salvo)
  useEffect(() => {
    async function loadUser() {
      const savedToken = localStorage.getItem(TOKEN_KEY);
      if (!savedToken) {
        setIsLoading(false);
        return;
      }
      try {
        const { data } = await api.get('/auth/me');
        setProfessional(data.data.professional);
        setToken(savedToken);
      } catch {
        // Token inválido: limpa estado
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    }
    loadUser();
  }, []);

  // Escuta mudanças de sessão do Supabase (ex: token expirado, login externo)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'TOKEN_REFRESHED' && session) {
          // Atualiza token quando Supabase faz refresh automático
          localStorage.setItem(TOKEN_KEY, session.access_token);
          setToken(session.access_token);
        }
        if (event === 'SIGNED_OUT') {
          setProfessional(null);
          setToken(null);
          localStorage.removeItem(TOKEN_KEY);
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  async function login(email: string, password: string) {
    const { data } = await api.post('/auth/login', { email, password });
    const { professional: prof, token: tok } = data.data;
    localStorage.setItem(TOKEN_KEY, tok);
    setToken(tok);
    setProfessional(prof);
  }

  async function register(registerData: RegisterData) {
    await api.post('/auth/register', registerData);
    // Após registro, faz login automaticamente
    await login(registerData.email, registerData.password);
  }

  async function logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      await supabase.auth.signOut();
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setProfessional(null);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        professional,
        token,
        isLoading,
        isAuthenticated: !!professional,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
