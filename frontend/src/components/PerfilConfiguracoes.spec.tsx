import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, act, render } from '@testing-library/react';
import PerfilModal from './PerfilModal';
import ConfiguracoesModal from './ConfiguracoesModal';
import { renderComProviders } from '../test/render';
import { AxiosError } from 'axios';
import { esperarSemCoresLiterais } from '../test/semCoresLiterais';
import { api } from '../lib/api';
import { limparArmazenamentoEmMemoria } from '../lib/armazenamento';
import { ThemeProvider } from '../context/ThemeContext';

describe('Perfil (Sheet, telas.html#perfil)', () => {
  it('abre com os dados atuais; Salvar só habilita quando algo muda e envia ao backend', async () => {
    renderComProviders(<PerfilModal aberto onFechar={vi.fn()} />, {
      routes: { put: { '/auth/perfil': (_u: string, body?: unknown) => ({ usuario: { id: 'u', nome: (body as { nome: string }).nome, email: 'c@teste.local', telefone: null, role: 'ADMIN', ativo: true } }) } },
    });
    const nome = screen.getByLabelText('Nome') as HTMLInputElement;
    expect(nome.value).not.toBe('');
    const salvar = screen.getByRole('button', { name: 'Salvar' });
    expect(salvar).toBeDisabled();
    fireEvent.change(nome, { target: { value: 'Carlos Andrade' } });
    expect(salvar).not.toBeDisabled();
    await act(async () => { fireEvent.click(salvar); });
    expect(api.put).toHaveBeenCalledWith('/auth/perfil', expect.objectContaining({ nome: 'Carlos Andrade' }));
  });

  it('mostra o papel em português e leva às Configurações', () => {
    const abrirConfig = vi.fn();
    renderComProviders(<PerfilModal aberto onFechar={vi.fn()} onAbrirConfiguracoes={abrirConfig} />);
    expect(screen.getByText(/Administrador|Gerente|Operador/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Configurações' }));
    expect(abrirConfig).toHaveBeenCalledTimes(1);
  });

  it('fechar e reabrir o Perfil limpa as senhas digitadas', () => {
    const { rerender } = renderComProviders(<PerfilModal aberto onFechar={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Alterar senha' }));
    fireEvent.change(screen.getByLabelText('Senha atual'), { target: { value: 'atual123' } });
    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'nova12345' } });
    rerender(<PerfilModal aberto={false} onFechar={vi.fn()} />);
    rerender(<PerfilModal aberto onFechar={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Alterar senha' }));
    expect((screen.getByLabelText('Senha atual') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Nova senha') as HTMLInputElement).value).toBe('');
  });

  it('a troca de senha só aparece ao pedir e valida antes de enviar', async () => {
    renderComProviders(<PerfilModal aberto onFechar={vi.fn()} />);
    expect(screen.queryByLabelText('Senha atual')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Alterar senha' }));
    fireEvent.change(screen.getByLabelText('Senha atual'), { target: { value: 'atual123' } });
    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: '123' } });
    await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: 'Alterar senha' })[1]); });
    expect(screen.getByRole('alert')).toHaveTextContent('pelo menos 6 caracteres');
    expect(api.put).not.toHaveBeenCalled();
  });
});

describe('Perfil - endurecimento F5', () => {
  const nuncaResponde = () => new Promise(() => {});

  function abrirTrocaSenha(atual: string, nova: string) {
    fireEvent.click(screen.getByRole('button', { name: 'Alterar senha' }));
    fireEvent.change(screen.getByLabelText('Senha atual'), { target: { value: atual } });
    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: nova } });
    return screen.getAllByRole('button', { name: 'Alterar senha' })[1];
  }

  it('duplo clique em Salvar envia o perfil uma vez só', async () => {
    renderComProviders(<PerfilModal aberto onFechar={vi.fn()} />, { routes: { put: { '/auth/perfil': nuncaResponde } } });
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Carlos Andrade' } });
    const salvar = screen.getByRole('button', { name: 'Salvar' });
    await act(async () => {
      fireEvent.click(salvar);
      fireEvent.click(salvar);
    });
    expect(vi.mocked(api.put).mock.calls.filter(([url]) => url === '/auth/perfil')).toHaveLength(1);
  });

  it('Enter/clique duplo na troca de senha envia uma vez só (a 2ª sairia com o token já revogado)', async () => {
    renderComProviders(<PerfilModal aberto onFechar={vi.fn()} />, { routes: { put: { '/auth/senha': nuncaResponde } } });
    const enviar = abrirTrocaSenha('atual123', 'nova12345');
    await act(async () => {
      fireEvent.click(enviar);
      fireEvent.click(enviar);
    });
    expect(vi.mocked(api.put).mock.calls.filter(([url]) => url === '/auth/senha')).toHaveLength(1);
  });

  it('mostra o detalhe da validação do backend (issues[0]) na troca de senha', async () => {
    renderComProviders(<PerfilModal aberto onFechar={vi.fn()} />, {
      routes: {
        put: {
          '/auth/senha': {
            status: 400,
            data: { message: 'Dados inválidos', issues: [{ message: 'deve ter no máximo 72 bytes', path: ['novaSenha'] }] },
          },
        },
      },
    });
    const enviar = abrirTrocaSenha('atual123', 'nova12345');
    await act(async () => {
      fireEvent.click(enviar);
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Nova senha: deve ter no máximo 72 bytes');
  });

  it('mostra o detalhe da validação do backend (issues[0]) ao salvar o perfil', async () => {
    renderComProviders(<PerfilModal aberto onFechar={vi.fn()} />, {
      routes: {
        put: {
          '/auth/perfil': {
            status: 400,
            data: { message: 'Dados inválidos', issues: [{ message: 'mínimo de 2 caracteres', path: ['nome'] }] },
          },
        },
      },
    });
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'C' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Nome: mínimo de 2 caracteres');
  });

  it('sem conexão, diz que não alcançou o servidor (não culpa a senha atual)', async () => {
    renderComProviders(<PerfilModal aberto onFechar={vi.fn()} />);
    vi.mocked(api.put).mockRejectedValueOnce(new AxiosError('Network Error', 'ERR_NETWORK'));
    const enviar = abrirTrocaSenha('atual123', 'nova12345');
    await act(async () => {
      fireEvent.click(enviar);
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Sem conexão com o servidor');
  });

  it('senha atual incorreta (400 com message) aparece como veio do backend', async () => {
    renderComProviders(<PerfilModal aberto onFechar={vi.fn()} />, {
      routes: { put: { '/auth/senha': { status: 400, data: { message: 'Senha atual incorreta' } } } },
    });
    const enviar = abrirTrocaSenha('errada1', 'nova12345');
    await act(async () => {
      fireEvent.click(enviar);
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Senha atual incorreta');
  });

  it('limite de 72 bytes: 72 envia, 73 é barrado antes do backend', async () => {
    renderComProviders(<PerfilModal aberto onFechar={vi.fn()} />, { routes: { put: { '/auth/senha': nuncaResponde } } });
    // 'é' ocupa 2 bytes em UTF-8: 36 x 'é' = 72 bytes; + 'a' = 73
    let enviar = abrirTrocaSenha('atual123', 'é'.repeat(36) + 'a');
    await act(async () => {
      fireEvent.click(enviar);
    });
    expect(screen.getByRole('alert')).toHaveTextContent('no máximo 72 bytes');
    expect(api.put).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'é'.repeat(36) } });
    enviar = screen.getAllByRole('button', { name: 'Alterar senha' })[1];
    await act(async () => {
      fireEvent.click(enviar);
    });
    expect(api.put).toHaveBeenCalledWith('/auth/senha', { senhaAtual: 'atual123', novaSenha: 'é'.repeat(36) });
  });

  it('senha só com espaços conta como vazia; 6 caracteres é o mínimo aceito', async () => {
    renderComProviders(<PerfilModal aberto onFechar={vi.fn()} />, { routes: { put: { '/auth/senha': nuncaResponde } } });
    let enviar = abrirTrocaSenha('   ', 'nova12345');
    await act(async () => {
      fireEvent.click(enviar);
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Preencha a senha atual e a nova senha.');

    fireEvent.change(screen.getByLabelText('Senha atual'), { target: { value: 'atual123' } });
    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: '123456' } });
    enviar = screen.getAllByRole('button', { name: 'Alterar senha' })[1];
    await act(async () => {
      fireEvent.click(enviar);
    });
    expect(api.put).toHaveBeenCalledTimes(1);
  });

  it('depois do sucesso, fechar e reabrir antes do aviso sumir não apaga o que se digita de novo', async () => {
    const { rerender } = renderComProviders(<PerfilModal aberto onFechar={vi.fn()} />, {
      routes: { put: { '/auth/senha': { message: 'Senha atualizada com sucesso', token: 'tok-novo' } } },
    });
    const enviar = abrirTrocaSenha('atual123', 'nova12345');
    await act(async () => {
      fireEvent.click(enviar);
    });
    expect(await screen.findByText('Senha alterada')).toBeInTheDocument();

    rerender(<PerfilModal aberto={false} onFechar={vi.fn()} />);
    rerender(<PerfilModal aberto onFechar={vi.fn()} />);
    abrirTrocaSenha('outra123', 'digitando');

    await act(async () => {
      await new Promise((r) => setTimeout(r, 1700));
    });
    expect(screen.getByLabelText('Senha atual')).toHaveValue('outra123');
    expect(screen.getByLabelText('Nova senha')).toHaveValue('digitando');
  });

  it('Sair encerra a sessão e fecha o Perfil', async () => {
    const onFechar = vi.fn();
    renderComProviders(<PerfilModal aberto onFechar={onFechar} />, { routes: { post: { '/auth/logout': {} } } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Sair/ }));
    });
    expect(onFechar).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('burger_stock_token')).toBeNull();
  });
});

describe('Configurações - endurecimento F5', () => {
  beforeEach(() => {
    limparArmazenamentoEmMemoria();
  });

  it('com o armazenamento bloqueado, alternar o som não quebra a tela', () => {
    renderComProviders(<ConfiguracoesModal aberto onFechar={vi.fn()} />);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('negado', 'SecurityError');
    });
    const som = screen.getByRole('switch', { name: 'Som e vibração no QR code' });
    fireEvent.click(som);
    expect(som).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(som);
    expect(som).toHaveAttribute('aria-checked', 'true');
  });

  it('com o armazenamento bloqueado, desligar o som persiste até fechar a aba (ao reabrir continua desligado)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('negado', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('negado', 'SecurityError');
    });
    const { unmount } = render(
      <ThemeProvider>
        <ConfiguracoesModal aberto onFechar={vi.fn()} />
      </ThemeProvider>
    );
    const som = screen.getByRole('switch', { name: 'Som e vibração no QR code' });
    expect(som).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(som);
    expect(som).toHaveAttribute('aria-checked', 'false');

    unmount();
    render(
      <ThemeProvider>
        <ConfiguracoesModal aberto onFechar={vi.fn()} />
      </ThemeProvider>
    );
    expect(screen.getByRole('switch', { name: 'Som e vibração no QR code' })).toHaveAttribute('aria-checked', 'false');
  });

  it('valor inválido salvo para o som vale como ligado', () => {
    localStorage.setItem('cfg_som_scanner', 'talvez');
    renderComProviders(<ConfiguracoesModal aberto onFechar={vi.fn()} />);
    expect(screen.getByRole('switch', { name: 'Som e vibração no QR code' })).toHaveAttribute('aria-checked', 'true');
  });

  it('som desligado salvo abre desligado', () => {
    localStorage.setItem('cfg_som_scanner', 'false');
    renderComProviders(<ConfiguracoesModal aberto onFechar={vi.fn()} />);
    expect(screen.getByRole('switch', { name: 'Som e vibração no QR code' })).toHaveAttribute('aria-checked', 'false');
  });

  it('abre com o tema atual marcado', () => {
    renderComProviders(<ConfiguracoesModal aberto onFechar={vi.fn()} />, { tema: 'dark' });
    expect(screen.getByRole('radio', { name: /Escuro/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /Claro/ })).toHaveAttribute('aria-checked', 'false');
  });

  it('o switch de som tem alvo de toque de pelo menos 44×44px', () => {
    renderComProviders(<ConfiguracoesModal aberto onFechar={vi.fn()} />);
    const som = screen.getByRole('switch', { name: 'Som e vibração no QR code' });
    expect(som.className).toContain('min-h-[44px]');
    expect(som.className).toContain('min-w-[44px]');
  });
});

describe('Configurações (Sheet, telas.html#config)', () => {
  it('troca o tema e liga/desliga o som do scanner (preferência lida pela tela de nota fiscal)', () => {
    renderComProviders(<ConfiguracoesModal aberto onFechar={vi.fn()} />);
    fireEvent.click(screen.getByRole('radio', { name: /Escuro/ }));
    expect(screen.getByRole('radio', { name: /Escuro/ })).toHaveAttribute('aria-checked', 'true');
    const som = screen.getByRole('switch', { name: 'Som e vibração no QR code' });
    expect(som).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(som);
    expect(som).toHaveAttribute('aria-checked', 'false');
    expect(localStorage.getItem('cfg_som_scanner')).toBe('false');
  });

  it('não mostra mais dados fixos nem interruptores sem efeito', () => {
    renderComProviders(<ConfiguracoesModal aberto onFechar={vi.fn()} />);
    expect(screen.queryByText(/CNPJ/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Lanches LTDA/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Estoque Mínimo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/17:50|23:15/)).not.toBeInTheDocument();
  });

  it('usa só tokens de design (Perfil, Configurações e Login)', () => {
    esperarSemCoresLiterais('src/components/PerfilModal.tsx');
    esperarSemCoresLiterais('src/components/ConfiguracoesModal.tsx');
  });
});
