import axios, { AxiosError } from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000'
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      if (window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  }
);

export function apiErrorMessage(caught: unknown, fallback: string) {
  if (axios.isAxiosError(caught)) {
    if (caught.response?.status === 503) {
      return 'Operação temporariamente indisponível porque o banco de dados não está pronto para transações financeiras.';
    }
    const data = caught.response?.data as { error?: { message?: string } } | undefined;
    return data?.error?.message ?? fallback;
  }
  if (caught instanceof Error) return caught.message;
  return fallback;
}
