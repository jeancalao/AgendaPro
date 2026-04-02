// Cliente HTTP Axios configurado com interceptors
import axios from 'axios';

// Em dev usa o proxy do Vite (/api → localhost:3001).
// Em produção usa a URL da API no Render via variável de ambiente.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api/v1`
    : '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Injeta o token automaticamente em toda requisição
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('agendapro:token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Redireciona para /login em caso de 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('agendapro:token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
