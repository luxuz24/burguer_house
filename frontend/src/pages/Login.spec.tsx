import { describe, it, expect } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import Login from './Login';
import { renderComProviders } from '../test/render';
import { esperarSemCoresLiterais } from '../test/semCoresLiterais';
import { api } from '../lib/api';

function abrir(postLogin: unknown = { status: 401, data: { message: 'E-mail ou senha incorretos' } }) {
  renderComProviders(<Login />, { autenticado: false, routes: { post: { '/auth/login': postLogin } } });
}

describe('pages/Login - esboço (telas.html#login)', () => {
  it('campos vazios: avisa sem chamar o backend', async () => {
    abrir();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Entrar/ })); });
    expect(screen.getByRole('alert')).toHaveTextContent('Por favor, preencha todos os campos.');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('credencial errada: mostra a mensagem do backend embaixo dos campos', async () => {
    abrir();
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'carlos@teste.local' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'errada' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Entrar/ })); });
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos');
  });

  it('o olho mostra e oculta a senha', () => {
    abrir();
    const senha = screen.getByLabelText('Senha');
    expect(senha).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    expect(senha).toHaveAttribute('type', 'text');
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar senha' }));
    expect(senha).toHaveAttribute('type', 'password');
  });

  it('usa só tokens de design', () => {
    esperarSemCoresLiterais('src/pages/Login.tsx');
  });
});
