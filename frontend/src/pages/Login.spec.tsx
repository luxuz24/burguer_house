import { describe, it, expect, vi } from 'vitest';
import { AxiosError } from 'axios';
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

  function preencher(email: string, senha: string) {
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: email } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: senha } });
  }

  it('duplo Enter/clique em Entrar envia o login uma vez só', async () => {
    abrir(() => new Promise(() => {}));
    preencher('carlos@teste.local', 'segredo1');
    const entrar = screen.getByRole('button', { name: /Entrar/ });
    await act(async () => {
      fireEvent.click(entrar);
      fireEvent.click(entrar);
    });
    expect(vi.mocked(api.post).mock.calls.filter(([url]) => url === '/auth/login')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /Entrando/ })).toBeDisabled();
  });

  it('e-mail com espaços nas pontas é enviado aparado', async () => {
    abrir();
    preencher('  carlos@teste.local  ', 'segredo1');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Entrar/ })); });
    expect(api.post).toHaveBeenCalledWith('/auth/login', { email: 'carlos@teste.local', senha: 'segredo1' });
  });

  it('400 do Zod mostra o detalhe do campo, não "Dados inválidos"', async () => {
    abrir({ status: 400, data: { message: 'Dados inválidos', issues: [{ message: 'Invalid email address', path: ['email'] }] } });
    preencher('carlos', 'segredo1');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Entrar/ })); });
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail: Invalid email address');
  });

  it('429 (muitas tentativas) mostra a mensagem do backend', async () => {
    abrir({ status: 429, data: { message: 'Muitas tentativas. Tente novamente em 15 minutos.' } });
    preencher('carlos@teste.local', 'segredo1');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Entrar/ })); });
    expect(await screen.findByRole('alert')).toHaveTextContent('Muitas tentativas');
  });

  it('sem resposta do servidor avisa que não há conexão', async () => {
    abrir();
    vi.mocked(api.post).mockRejectedValueOnce(new AxiosError('Network Error', 'ERR_NETWORK'));
    preencher('carlos@teste.local', 'segredo1');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Entrar/ })); });
    expect(await screen.findByRole('alert')).toHaveTextContent('Sem conexão com o servidor');
  });

  it('falha local (não HTTP) não é apresentada como falta de conexão', async () => {
    abrir();
    vi.mocked(api.post).mockRejectedValueOnce(new TypeError('quebrou'));
    preencher('carlos@teste.local', 'segredo1');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Entrar/ })); });
    const alerta = await screen.findByRole('alert');
    expect(alerta).not.toHaveTextContent(/conex|conectar/i);
    expect(alerta).toHaveTextContent('Não foi possível entrar');
  });

  it('senha só com espaços conta como vazia', async () => {
    abrir();
    preencher('carlos@teste.local', '   ');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Entrar/ })); });
    expect(screen.getByRole('alert')).toHaveTextContent('Por favor, preencha todos os campos.');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('depois de um erro, o botão volta a ficar disponível', async () => {
    abrir();
    preencher('carlos@teste.local', 'errada');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Entrar/ })); });
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: /Entrar/ })).not.toBeDisabled();
  });

  it('usa só tokens de design', () => {
    esperarSemCoresLiterais('src/pages/Login.tsx');
  });
});
