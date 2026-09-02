import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@condominio.local');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('auth_token', data.token);
      navigate('/dashboard');
    } catch {
      setError('Falha no login. Verifique as credenciais.');
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
        <form className="stack" onSubmit={handleSubmit}>
          <label>
            E-mail
            <input value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            Senha
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" className="primary-button">
            Entrar
          </button>
        </form>
      </section>
    </div>
  );
}
