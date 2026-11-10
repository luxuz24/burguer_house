import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import PerfilModal from './PerfilModal';
import ConfiguracoesModal from './ConfiguracoesModal';
import { renderComProviders } from '../test/render';
import { esperarSemCoresLiterais } from '../test/semCoresLiterais';
import { api } from '../lib/api';

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
