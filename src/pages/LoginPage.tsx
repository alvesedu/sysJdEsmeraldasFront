import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { api } from '../api/client';

const loginSchema = z.object({
  email: z.string().min(1, 'Informe o e-mail.').email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe a senha.')
});

type LoginForm = z.infer<typeof loginSchema>;
type LoginResponse = { token: string };

export function LoginPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting }
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema)
  });

  async function onSubmit(values: LoginForm) {
    try {
      const { data } = await api.post<LoginResponse>('/auth/login', {
        email: values.email.trim(),
        password: values.password
      });
      localStorage.setItem('auth_token', data.token);
      navigate('/dashboard');
    } catch {
      setError('root', { message: 'Falha no login. Verifique as credenciais.' });
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-panel">
        <p className="eyebrow">Gestão financeira de condomínio</p>
        <h1>Controle receitas, despesas e conciliação sem perder o histórico.</h1>
        <p className="lead">
          Base preparada para cobranças por unidade, extrato bancário PDF, alocações parciais e fechamento mensal.
        </p>
      </section>

      <section className="auth-card">
        <h2>Acesso administrativo</h2>
        <form className="stack auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <label>
            Usuário (e-mail)
            <input
              autoComplete="email"
              placeholder="Digite seu usuário"
              aria-invalid={errors.email ? 'true' : 'false'}
              {...register('email')}
            />
            {errors.email?.message ? <span className="field-error">{errors.email.message}</span> : null}
          </label>
          <label>
            Senha
            <span className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Digite sua senha"
                aria-invalid={errors.password ? 'true' : 'false'}
                {...register('password')}
              />
              <button
                type="button"
                className="password-toggle"
                aria-label={showPassword ? 'Ocultar senha' : 'Visualizar senha'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                    <path d="M3 3l18 18" />
                    <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                    <path d="M9.9 4.2A9.7 9.7 0 0 1 12 4c5 0 8.5 4.2 9.5 8a10.7 10.7 0 0 1-2.3 4.1" />
                    <path d="M6.6 6.6A10.8 10.8 0 0 0 2.5 12C3.5 15.8 7 20 12 20c1.5 0 2.9-.4 4.1-1" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                    <path d="M2.5 12C3.5 8.2 7 4 12 4s8.5 4.2 9.5 8c-1 3.8-4.5 8-9.5 8s-8.5-4.2-9.5-8Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </span>
            {errors.password?.message ? <span className="field-error">{errors.password.message}</span> : null}
          </label>
          {errors.root?.message ? <p className="error">{errors.root.message}</p> : null}
          <button type="submit" className="primary-button" disabled={isSubmitting}>
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </div>
  );
}
