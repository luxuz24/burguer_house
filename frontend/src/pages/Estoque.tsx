import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { motion } from 'motion/react';
import { api, mensagemDeErro } from '../lib/api';
import { usePodeGerir } from '../hooks/usePodeGerir';
import AvisoSomenteLeitura from '../components/AvisoSomenteLeitura';
import { useFeedback } from '../context/FeedbackContext';
import { useEnvio } from '../hooks/useEnvio';
import { useCarregamento } from '../hooks/useCarregamento';
import { stagger, rise, tap } from '../lib/motion';
import EstadoVazio from '../components/EstadoVazio';
import FichaTecnica from './FichaTecnica';
import PreparoInterno from './PreparoInterno';
import ImportarNotaFiscal from './ImportarNotaFiscal';
import EntradaManual from './EntradaManual';
import ContagemEstoque from './ContagemEstoque';
import { HistoricoMovimentacoes } from '../components/HistoricoMovimentacoes';
import { Plus, PencilSimple, Trash, Package, Warning, ChefHat, QrCode, MagnifyingGlass, CookingPot, Hamburger, CaretRight, Lock, Scales } from '../components/ui/icons';
import Sheet from '../components/ui/Sheet';
import { formatarPercentual, formatarQuantidade, normalizarBusca } from '../lib/formatar';
import VendasRetidasPainel from '../components/VendasRetidasPainel';
import {
  buscarVendasRetidas,
  mesclarPaginasRetidas,
  normalizarRespostaRetidas,
  type AcaoVendaRetida,
  type VendasRetidasResposta,
} from '../lib/vendasRetidas';

import { categoriaDoInsumo, type AbaEstoque, type CategoriaInsumo } from '../lib/categoriaInsumo';
import { normalizarUnidade } from '../lib/unidades';

const CATEGORIAS_INSUMO: ReadonlyArray<{
  valor: CategoriaInsumo;
  rotulo: string;
  tituloNovo: string;
}> = [
  { valor: 'INGREDIENTE', rotulo: 'Ingrediente', tituloNovo: 'Novo insumo' },
  { valor: 'EMBALAGEM', rotulo: 'Embalagem', tituloNovo: 'Nova embalagem' },
  { valor: 'BEBIDA', rotulo: 'Bebida', tituloNovo: 'Nova bebida' },
];

const ABAS_ESTOQUE: ReadonlyArray<{
  id: AbaEstoque;
  rotulo: string;
  categoria?: CategoriaInsumo;
  placeholderBusca: string;
}> = [
  { id: 'insumos', rotulo: 'Insumos', categoria: 'INGREDIENTE', placeholderBusca: 'Buscar insumo' },
  { id: 'embalagens', rotulo: 'Embalagens', categoria: 'EMBALAGEM', placeholderBusca: 'Buscar embalagem' },
  { id: 'bebidas', rotulo: 'Bebidas', categoria: 'BEBIDA', placeholderBusca: 'Buscar bebida' },
  { id: 'produtos', rotulo: 'Prontos', placeholderBusca: 'Buscar produto' },
];

const ESTADO_VAZIO_POR_ABA: Record<Exclude<AbaEstoque, 'produtos'>, { titulo: string; descricao: string; acao: string }> = {
  insumos: {
    titulo: 'Nenhum insumo cadastrado',
    descricao: 'Cadastre os ingredientes da casa para começar a controlar o estoque.',
    acao: 'Cadastrar primeiro insumo',
  },
  embalagens: {
    titulo: 'Nenhuma embalagem cadastrada',
    descricao: 'Nenhuma embalagem cadastrada. Toque em + para cadastrar.',
    acao: 'Cadastrar embalagem',
  },
  bebidas: {
    titulo: 'Nenhuma bebida cadastrada',
    descricao: 'Nenhuma bebida cadastrada. Toque em + para cadastrar.',
    acao: 'Cadastrar bebida',
  },
};

interface Insumo {
  id: string;
  nome: string;
  unidade: string;
  categoria?: string | null;
  estoqueAtual: number;
  estoqueMinimo: number;
  custoUnitario?: number;
  fatorPerda?: number;
  produzidoInternamente?: boolean;
  validadeDias?: number | null;
  atualizadoEm?: string;
}

function calcularValidade(insumo: Insumo) {
  if (!insumo.produzidoInternamente || !insumo.validadeDias || !insumo.atualizadoEm || insumo.estoqueAtual <= 0) {
    return null;
  }
  const atualizado = new Date(insumo.atualizadoEm).getTime();
  const validadeMs = insumo.validadeDias * 86_400_000;
  const expiraEm = atualizado + validadeMs;
  const diffDias = Math.ceil((expiraEm - Date.now()) / 86_400_000);
  return {
    diasRestantes: diffDias,
    vencido: diffDias <= 0,
    alerta: diffDias > 0 && diffDias <= 2,
  };
}

function estaCritico(insumo: Insumo): boolean {
  return insumo.estoqueMinimo > 0
    ? insumo.estoqueAtual <= insumo.estoqueMinimo
    : insumo.estoqueAtual <= 0;
}

function temAlerta(insumo: Insumo): boolean {
  const val = calcularValidade(insumo);
  return estaCritico(insumo) || (val ? val.vencido || val.alerta : false);
}

const formatadorCustoUnitario = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

interface FormInsumo {
  id: string;
  nome: string;
  unidade: string;
  categoria: CategoriaInsumo;
  estoqueAtual: number | '';
  estoqueMinimo: number | '';
  custoUnitario: number | '';
  fatorPerdaPct: number | '';
  produzidoInternamente?: boolean;
  validadeDias?: number | '';
}

// O catálogo grava "Unidade" (planilha da loja). Uma grafia diferente já gravada (ex.: "Unidades") entra como
// opção própria, para o seletor mostrar a unidade certa e salvar sem trocá-la sem querer.
const UNIDADES_FORM = [
  { valor: 'Gramas', rotulo: 'g' },
  { valor: 'Unidade', rotulo: 'un' },
  { valor: 'Mililitros', rotulo: 'ml' },
];

function opcoesUnidade(atual: string) {
  if (!atual || UNIDADES_FORM.some((u) => u.valor === atual)) return UNIDADES_FORM;
  const canonica = normalizarUnidade(atual);
  const rotulo = canonica === 'UN' ? 'un' : canonica === 'G' ? 'g' : canonica === 'ML' ? 'ml' : atual;
  return [...UNIDADES_FORM, { valor: atual, rotulo }];
}

const formInsumoVazio: FormInsumo = {
  id: '',
  nome: '',
  unidade: 'Gramas',
  categoria: 'INGREDIENTE',
  estoqueAtual: '',
  estoqueMinimo: '',
  custoUnitario: '',
  fatorPerdaPct: '',
  produzidoInternamente: false,
  validadeDias: '',
};

interface Produto {
  id: string;
  nome: string;
}

export interface DestinoEstoque {
  seq: number;
  aba: AbaEstoque;
  acaoRetida?: AcaoVendaRetida;
}

interface EstoqueProps {
  destinoInicial?: DestinoEstoque | null;
}

export default function Estoque({ destinoInicial }: EstoqueProps = {}) {
  // Só o ADMIN altera estoque, cadastro e cardápio; os demais papéis só consultam
  const podeGerir = usePodeGerir();
  // A correção vinda das vendas retidas abre formulários de escrita: ignorada para quem não gere
  const acaoInicial = podeGerir ? destinoInicial?.acaoRetida : undefined;
  const [abaAtiva, setAbaAtiva] = useState<AbaEstoque>(destinoInicial?.aba ?? 'insumos');
  const tabRefs = useRef<Partial<Record<AbaEstoque, HTMLButtonElement | null>>>({});
  
  // Estados para Insumos
  const [mostrarFormInsumo, setMostrarFormInsumo] = useState(false);
  const [modoSheetInsumo, setModoSheetInsumo] = useState<'detalhes' | 'formulario'>('formulario');
  const [insumoSelecionado, setInsumoSelecionado] = useState<Insumo | null>(null);
  const [formInsumo, setFormInsumo] = useState<FormInsumo>(formInsumoVazio);
  const [beneficiadoSelecionadoId, setBeneficiadoSelecionadoId] = useState<string | null>(null);
  const [filtroInsumos, setFiltroInsumos] = useState<'todos' | 'beneficiados' | 'alertas'>('todos');
  const [busca, setBusca] = useState(
    acaoInicial?.tipo === 'COLISAO_NOME' ? acaoInicial.produto : '',
  );
  const [mostrarImportarNota, setMostrarImportarNota] = useState(false);
  const [mostrarEntradaManual, setMostrarEntradaManual] = useState(false);
  const [mostrarContagemEstoque, setMostrarContagemEstoque] = useState(false);

  // Estados para Produtos e vendas retidas
  const [produtoSelecionadoId, setProdutoSelecionadoId] = useState<string | null>(null);
  const [mostrarFormProduto, setMostrarFormProduto] = useState(
    acaoInicial?.tipo === 'PRODUTO_NAO_ENCONTRADO',
  );
  const [nomeNovoProduto, setNomeNovoProduto] = useState(
    acaoInicial?.tipo === 'PRODUTO_NAO_ENCONTRADO' ? acaoInicial.produto : '',
  );
  const [produtoConflito, setProdutoConflito] = useState<{ id: string; nome: string } | null>(null);
  const [acaoInicialConsumida, setAcaoInicialConsumida] = useState(false);
  const [paginasRetidas, setPaginasRetidas] = useState<{
    baseRef: VendasRetidasResposta | null | undefined;
    dado: VendasRetidasResposta;
  } | null>(null);
  const [carregandoMaisRetidas, setCarregandoMaisRetidas] = useState(false);

  const { toast, confirmar } = useFeedback();

  const buscarInsumos = useCallback(() => api.get<Insumo[]>('/insumos').then((r) => r.data), []);
  const buscarProdutos = useCallback(() => api.get<Produto[]>('/produtos').then((r) => r.data), []);

  const {
    dados: insumosDados,
    carregandoInicial: carregandoInsumos,
    erro: erroInsumos,
    erroRecarga: erroRecargaInsumos,
    recarregar: recarregarInsumos,
  } = useCarregamento(buscarInsumos, [], {
    habilitado: abaAtiva !== 'produtos',
    mensagemPadrao: 'Erro ao carregar insumos.',
  });

  const {
    dados: produtosDados,
    carregandoInicial: carregandoProdutos,
    erro: erroProdutos,
    erroRecarga: erroRecargaProdutos,
    recarregar: recarregarProdutos,
  } = useCarregamento(buscarProdutos, [], {
    habilitado: abaAtiva === 'produtos',
    mensagemPadrao: 'Erro ao carregar produtos.',
  });

  const { dados: retidasBase, recarregar: recarregarRetidas } = useCarregamento(buscarVendasRetidas, [], {
    habilitado: abaAtiva === 'produtos',
    mensagemPadrao: '',
  });

  const insumos = insumosDados ?? [];
  const insumoDetalhe = insumoSelecionado
    ? (insumos.find((item) => item.id === insumoSelecionado.id) ?? insumoSelecionado)
    : null;
  const produtos = produtosDados ?? [];
  const retidasExibidas =
    paginasRetidas && paginasRetidas.baseRef === retidasBase ? paginasRetidas.dado : retidasBase;

  const produtoInicialSemFichaId =
    !acaoInicialConsumida && acaoInicial?.tipo === 'PRODUTO_SEM_FICHA' && produtosDados
      ? (produtosDados.find((p) => normalizarBusca(p.nome) === normalizarBusca(acaoInicial.produto))
          ?.id ?? null)
      : null;
  const produtoAbertoId = produtoSelecionadoId ?? produtoInicialSemFichaId;

  const carregarMaisRetidas = useCallback(async () => {
    if (!retidasExibidas || !retidasExibidas.temMais || carregandoMaisRetidas) return;
    setCarregandoMaisRetidas(true);
    try {
      const resp = await api.get('/vendas/retidas', {
        params: {
          limite: retidasExibidas.limite,
          offset: retidasExibidas.offset + retidasExibidas.limite,
        },
      });
      const proxima = normalizarRespostaRetidas(resp.data);
      if (!proxima) return;
      setPaginasRetidas({
        baseRef: retidasBase,
        dado: mesclarPaginasRetidas(retidasExibidas, proxima),
      });
    } catch (error) {
      toast.erro(mensagemDeErro(error, 'Erro ao carregar mais vendas retidas.'));
    } finally {
      setCarregandoMaisRetidas(false);
    }
  }, [retidasBase, retidasExibidas, carregandoMaisRetidas, toast]);

  const executarAcaoRetida = useCallback(
    (acao: AcaoVendaRetida, listaProdutos: Produto[]) => {
      if (acao.tipo === 'PRODUTO_NAO_ENCONTRADO') {
        setBusca('');
        setProdutoConflito(null);
        setNomeNovoProduto(acao.produto);
        setMostrarFormProduto(true);
        return;
      }
      if (acao.tipo === 'PRODUTO_SEM_FICHA') {
        const alvo = listaProdutos.find(
          (p) => normalizarBusca(p.nome) === normalizarBusca(acao.produto),
        );
        if (alvo) {
          setProdutoSelecionadoId(alvo.id);
        } else {
          setBusca(acao.produto);
          toast.aviso(`Selecione "${acao.produto}" para montar a ficha técnica.`);
        }
        return;
      }
      if (acao.tipo === 'COLISAO_NOME') {
        setBusca(acao.produto);
      }
    },
    [toast],
  );

  const ultimoErroInsumosRef = useRef<typeof erroInsumos>(null);
  const ultimoErroRecargaInsumosRef = useRef<string | null>(null);

  useEffect(() => {
    if (!erroInsumos) {
      ultimoErroInsumosRef.current = null;
      return;
    }
    if (abaAtiva !== 'produtos' && ultimoErroInsumosRef.current !== erroInsumos) {
      ultimoErroInsumosRef.current = erroInsumos;
      toast.erro(erroInsumos.mensagem);
    }
  }, [abaAtiva, erroInsumos, toast]);

  useEffect(() => {
    // useCarregamento limpa erroRecarga para null ao iniciar nova recarga, zerando esta ref entre falhas seguidas
    if (!erroRecargaInsumos) {
      ultimoErroRecargaInsumosRef.current = null;
      return;
    }
    if (abaAtiva !== 'produtos' && ultimoErroRecargaInsumosRef.current !== erroRecargaInsumos) {
      ultimoErroRecargaInsumosRef.current = erroRecargaInsumos;
      toast.erro(erroRecargaInsumos);
    }
  }, [abaAtiva, erroRecargaInsumos, toast]);

  useEffect(() => {
    if (abaAtiva === 'produtos' && erroProdutos) {
      toast.erro(erroProdutos.mensagem);
    }
  }, [abaAtiva, erroProdutos, toast]);

  useEffect(() => {
    if (abaAtiva === 'produtos' && erroRecargaProdutos) {
      toast.erro(erroRecargaProdutos);
    }
  }, [abaAtiva, erroRecargaProdutos, toast]);

  const selecionarAba = useCallback((novaAba: AbaEstoque) => {
    setAbaAtiva(novaAba);
    if (novaAba !== 'insumos' && filtroInsumos === 'beneficiados') {
      setFiltroInsumos('todos');
    }
  }, [filtroInsumos]);

  const fecharSheetInsumo = useCallback(() => {
    setMostrarFormInsumo(false);
    setInsumoSelecionado(null);
    setFormInsumo(formInsumoVazio);
  }, []);

  const categoriaAtiva: CategoriaInsumo =
    ABAS_ESTOQUE.find((a) => a.id === abaAtiva)?.categoria ?? 'INGREDIENTE';

  const abrirNovoInsumo = useCallback(() => {
    setInsumoSelecionado(null);
    setFormInsumo({ ...formInsumoVazio, categoria: categoriaAtiva });
    setModoSheetInsumo('formulario');
    setMostrarFormInsumo(true);
  }, [categoriaAtiva]);

  const abrirDetalhesInsumo = useCallback((insumo: Insumo) => {
    setInsumoSelecionado(insumo);
    setModoSheetInsumo('detalhes');
    setMostrarFormInsumo(true);
  }, []);

  const iniciarEdicaoInsumo = useCallback((insumo: Insumo) => {
    setFormInsumo({
      id: insumo.id,
      nome: insumo.nome,
      unidade: insumo.unidade,
      categoria: categoriaDoInsumo(insumo),
      estoqueAtual: insumo.estoqueAtual,
      estoqueMinimo: insumo.estoqueMinimo,
      custoUnitario: insumo.custoUnitario ?? '',
      fatorPerdaPct: insumo.fatorPerda ? Number((insumo.fatorPerda * 100).toFixed(2)) : '',
      produzidoInternamente: insumo.produzidoInternamente,
      validadeDias: insumo.validadeDias ?? '',
    });
    setModoSheetInsumo('formulario');
  }, []);

  const { enviando: salvandoInsumo, executar: executarSalvarInsumo } = useEnvio(async () => {
    const nome = formInsumo.nome.trim();
    if (!nome) {
      toast.erro('O nome do insumo é obrigatório.');
      return;
    }

    if (formInsumo.fatorPerdaPct !== '') {
      const pct = Number(formInsumo.fatorPerdaPct);
      if (isNaN(pct) || pct < 0 || pct > 100) {
        toast.erro('Fator de perda deve estar entre 0% e 100%.');
        return;
      }
    }

    const editando = !!formInsumo.id;
    const categoriaAnterior = insumoSelecionado ? categoriaDoInsumo(insumoSelecionado) : formInsumo.categoria;
    const mudouCategoria = editando && categoriaAnterior !== formInsumo.categoria;
    const basePayload = {
      nome,
      unidade: formInsumo.unidade,
      categoria: formInsumo.categoria,
      estoqueMinimo: formInsumo.estoqueMinimo === '' ? 0 : Number(formInsumo.estoqueMinimo),
      custoUnitario: formInsumo.custoUnitario === '' ? 0 : Number(formInsumo.custoUnitario),
      fatorPerda: formInsumo.fatorPerdaPct === '' ? 0 : Number((Number(formInsumo.fatorPerdaPct) / 100).toFixed(4)),
      produzidoInternamente: formInsumo.produzidoInternamente,
      validadeDias: formInsumo.produzidoInternamente && formInsumo.validadeDias !== '' ? Number(formInsumo.validadeDias) : null,
    };

    try {
      if (editando) {
        await api.put(`/insumos/${formInsumo.id}`, basePayload);
      } else {
        await api.post('/insumos', {
          ...basePayload,
          estoqueAtual: formInsumo.estoqueAtual === '' ? 0 : Number(formInsumo.estoqueAtual),
        });
      }
      fecharSheetInsumo();
      await recarregarInsumos();
      if (mudouCategoria) {
        const abaDestino = ABAS_ESTOQUE.find((a) => a.categoria === formInsumo.categoria);
        if (abaDestino) {
          selecionarAba(abaDestino.id);
        }
        toast.sucesso(`Movido para ${abaDestino?.rotulo ?? 'Insumos'}.`);
      } else {
        toast.sucesso(editando ? `"${basePayload.nome}" atualizado.` : `"${basePayload.nome}" cadastrado.`);
      }
    } catch (error) {
      toast.erro(mensagemDeErro(error, 'Erro ao salvar insumo.'));
    }
  });

  const { enviando: excluindoInsumo, executar: executarExcluirInsumo } = useEnvio(async (insumo: Insumo) => {
    const ok = await confirmar({
      titulo: 'Apagar insumo',
      mensagem: `Deseja realmente apagar "${insumo.nome}"? Esta ação não pode ser desfeita.`,
      textoConfirmar: 'Apagar',
      perigoso: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/insumos/${insumo.id}`);
      fecharSheetInsumo();
      await recarregarInsumos();
      toast.sucesso(`"${insumo.nome}" removido.`);
    } catch (error) {
      toast.erro(mensagemDeErro(error, 'Falha ao apagar insumo (pode estar em uso em uma ficha técnica).'));
    }
  });

  const { enviando: criandoProduto, executar: executarCriarProduto } = useEnvio(async () => {
    const nome = nomeNovoProduto.trim();
    if (!nome) {
      toast.erro('O nome do produto é obrigatório.');
      return;
    }
    try {
      const res = await api.post('/produtos', { nome });
      setNomeNovoProduto('');
      setMostrarFormProduto(false);
      setProdutoConflito(null);
      await recarregarProdutos();
      void recarregarRetidas();
      toast.sucesso(`Produto "${nome}" criado! Adicione os ingredientes da ficha técnica.`);
      if (res.data?.id) {
        setProdutoSelecionadoId(res.data.id);
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409 && error.response.data?.produtoConflito) {
        setProdutoConflito(error.response.data.produtoConflito);
      }
      toast.erro(mensagemDeErro(error, 'Erro ao criar produto.'));
    }
  });

  const deletarProduto = async (prod: Produto, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirmar({
      titulo: 'Apagar produto',
      mensagem: `Deseja realmente apagar o produto "${prod.nome}" e sua ficha técnica?`,
      textoConfirmar: 'Apagar',
      perigoso: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/produtos/${prod.id}`);
      await recarregarProdutos();
      void recarregarRetidas();
      toast.sucesso(`Produto "${prod.nome}" removido.`);
    } catch (error) {
      toast.erro(mensagemDeErro(error, 'Erro ao apagar produto.'));
    }
  };

  const lidarTeclaAba = useCallback((e: React.KeyboardEvent, indiceAtual: number) => {
    let proximoIndice: number | null = null;
    if (e.key === 'ArrowRight') proximoIndice = (indiceAtual + 1) % ABAS_ESTOQUE.length;
    else if (e.key === 'ArrowLeft') proximoIndice = (indiceAtual - 1 + ABAS_ESTOQUE.length) % ABAS_ESTOQUE.length;
    else if (e.key === 'Home') proximoIndice = 0;
    else if (e.key === 'End') proximoIndice = ABAS_ESTOQUE.length - 1;
    if (proximoIndice === null) return;
    e.preventDefault();
    const proxima = ABAS_ESTOQUE[proximoIndice];
    selecionarAba(proxima.id);
    tabRefs.current[proxima.id]?.focus();
  }, [selecionarAba]);

  const abaConfig = ABAS_ESTOQUE.find((a) => a.id === abaAtiva) ?? ABAS_ESTOQUE[0];
  const termo = normalizarBusca(busca);
  const casaComBusca = (nome: string) => !termo || normalizarBusca(nome).includes(termo);

  const alertasPorCategoria: Record<CategoriaInsumo, number> = {
    INGREDIENTE: 0,
    EMBALAGEM: 0,
    BEBIDA: 0,
  };
  for (const insumo of insumos) {
    if (temAlerta(insumo)) {
      alertasPorCategoria[categoriaDoInsumo(insumo)] += 1;
    }
  }

  const insumosDaAba = insumos.filter((insumo) => categoriaDoInsumo(insumo) === categoriaAtiva);
  const insumosFiltrados = insumosDaAba.filter((insumo) => {
    if (!casaComBusca(insumo.nome)) return false;
    if (abaAtiva === 'insumos' && filtroInsumos === 'beneficiados') return !!insumo.produzidoInternamente;
    if (filtroInsumos === 'alertas') return temAlerta(insumo);
    return true;
  });

  const totalAlertas = alertasPorCategoria[categoriaAtiva];
  const produtosFiltrados = produtos.filter((prod) => casaComBusca(prod.nome));

  // Se um produto foi selecionado, renderiza a tela de Ficha Técnica (e passa prop para voltar)
  if (produtoAbertoId) {
    return (
      <FichaTecnica
        key={produtoAbertoId}
        produtoId={produtoAbertoId}
        onVoltar={() => {
          setProdutoSelecionadoId(null);
          setAcaoInicialConsumida(true);
          void recarregarProdutos();
          void recarregarRetidas();
        }}
        onSelecionarProduto={(id) => {
          setAcaoInicialConsumida(true);
          setProdutoSelecionadoId(id);
        }}
      />
    );
  }

  if (beneficiadoSelecionadoId) {
    return <PreparoInterno insumoId={beneficiadoSelecionadoId} onVoltar={() => { setBeneficiadoSelecionadoId(null); void recarregarInsumos(); }} />;
  }

  // Telas de ação: só para quem gere (os botões que as abrem também ficam escondidos)
  if (podeGerir && mostrarImportarNota) {
    return <ImportarNotaFiscal onVoltar={() => { setMostrarImportarNota(false); void recarregarInsumos(); }} />;
  }

  if (podeGerir && mostrarEntradaManual) {
    return (
      <EntradaManual
        onSucesso={() => {
          void recarregarInsumos();
        }}
        onVoltar={() => {
          setMostrarEntradaManual(false);
          void recarregarInsumos();
        }}
      />
    );
  }

  if (podeGerir && mostrarContagemEstoque) {
    return (
      <ContagemEstoque
        onSucesso={() => {
          void recarregarInsumos();
        }}
        onVoltar={() => {
          setMostrarContagemEstoque(false);
          void recarregarInsumos();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col min-h-full pb-20 bg-canvas text-ink transition-colors">
      
      {/* Título, nota fiscal e abas */}
      <div className="px-4 pt-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h1 className="text-xl font-bold text-ink">Estoque</h1>
          {podeGerir && abaAtiva !== 'produtos' && (
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <motion.button
                type="button"
                whileTap={tap}
                onClick={() => setMostrarContagemEstoque(true)}
                className="min-h-[44px] px-3 rounded-2xl bg-secondary-soft text-secondary text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Scales size={16} weight="duotone" />
                <span>Contagem</span>
              </motion.button>
              <motion.button
                type="button"
                whileTap={tap}
                onClick={() => setMostrarEntradaManual(true)}
                className="min-h-[44px] px-3 rounded-2xl bg-secondary-soft text-secondary text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Plus size={16} weight="bold" />
                <span>Entrada sem nota</span>
              </motion.button>
              <motion.button
                type="button"
                whileTap={tap}
                onClick={() => setMostrarImportarNota(true)}
                aria-label="Importar NF-e"
                title="Importar nota fiscal"
                className="w-11 h-11 min-h-[44px] min-w-[44px] rounded-2xl bg-secondary-soft text-secondary flex items-center justify-center cursor-pointer shrink-0"
              >
                <QrCode size={22} weight="duotone" />
              </motion.button>
            </div>
          )}
        </div>
        {!podeGerir && <AvisoSomenteLeitura />}
        <div role="tablist" aria-label="Categorias do estoque" className="flex bg-field rounded-2xl p-1 gap-1">
          {ABAS_ESTOQUE.map((aba, indice) => {
            const ativa = abaAtiva === aba.id;
            const qtdAlertas = aba.categoria ? alertasPorCategoria[aba.categoria] : 0;
            return (
              <button
                key={aba.id}
                ref={(el) => { tabRefs.current[aba.id] = el; }}
                id={`tab-${aba.id}`}
                type="button"
                role="tab"
                aria-selected={ativa}
                aria-controls={ativa ? `panel-${aba.id}` : undefined}
                tabIndex={ativa ? 0 : -1}
                onClick={() => selecionarAba(aba.id)}
                onKeyDown={(e) => lidarTeclaAba(e, indice)}
                className={`flex-auto rounded-xl min-h-[44px] px-1.5 sm:px-2 text-[11px] sm:text-sm font-semibold cursor-pointer transition-colors flex items-center justify-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                  ativa ? 'bg-card text-ink shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                <span className="truncate">{aba.rotulo}</span>
                {qtdAlertas > 0 && (
                  <span
                    aria-label={`${qtdAlertas} alerta(s)`}
                    className="shrink-0 min-w-[16px] h-4 px-1 rounded-full bg-danger text-canvas text-[10px] font-bold inline-flex items-center justify-center leading-none"
                  >
                    {qtdAlertas}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 bg-field border border-line rounded-2xl px-3 min-h-[46px] focus-within:ring-2 focus-within:ring-primary/40">
          <MagnifyingGlass size={18} className="text-muted shrink-0" />
          <input
            aria-label={abaConfig.placeholderBusca}
            placeholder={abaConfig.placeholderBusca}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none"
          />
        </div>
      </div>

      <div className="p-4">
        {abaAtiva !== 'produtos' && (
          <div role="tabpanel" id={`panel-${abaAtiva}`} aria-labelledby={`tab-${abaAtiva}`} className="space-y-4">
            {/* Detalhes, cadastro e edição de insumo (Sheet) */}
            <Sheet
              open={mostrarFormInsumo}
              onClose={fecharSheetInsumo}
              title={
                modoSheetInsumo === 'detalhes' && insumoDetalhe
                  ? insumoDetalhe.nome
                  : formInsumo.id
                    ? 'Editar insumo'
                    : (CATEGORIAS_INSUMO.find((c) => c.valor === formInsumo.categoria)?.tituloNovo ?? 'Novo insumo')
              }
              subtitle={
                modoSheetInsumo === 'detalhes' && insumoDetalhe
                  ? `Unidade: ${insumoDetalhe.unidade}`
                  : undefined
              }
              icon={<Package size={22} weight="duotone" />}
            >
              {modoSheetInsumo === 'detalhes' && insumoDetalhe ? (
                <div className="space-y-3 pb-2">
                  <div className="bg-field border border-line rounded-2xl p-3 flex items-center gap-2.5 text-xs text-muted">
                    <Lock size={16} className="shrink-0 text-muted" />
                    <div className="min-w-0">
                      <p className="text-ink font-semibold">
                        Estoque atual: {formatarQuantidade(insumoDetalhe.estoqueAtual, insumoDetalhe.unidade)}
                      </p>
                      <p className="mt-0.5">Muda só por NF, entrada sem nota, contagem, perdas, vendas e produção.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-card-2 border border-line rounded-xl p-2.5">
                      <p className="text-muted">Mínimo seguro</p>
                      <p className="font-semibold text-ink mt-0.5">
                        {formatarQuantidade(insumoDetalhe.estoqueMinimo, insumoDetalhe.unidade)}
                      </p>
                    </div>
                    <div className="bg-card-2 border border-line rounded-xl p-2.5">
                      <p className="text-muted">Custo unitário</p>
                      <p className="font-semibold text-ink mt-0.5">
                        {typeof insumoDetalhe.custoUnitario === 'number' && insumoDetalhe.custoUnitario > 0
                          ? formatadorCustoUnitario.format(insumoDetalhe.custoUnitario)
                          : 'Não informado'}
                      </p>
                    </div>
                    <div className="bg-card-2 border border-line rounded-xl p-2.5">
                      <p className="text-muted">Fator de perda</p>
                      <p className="font-semibold text-ink mt-0.5">
                        {formatarPercentual(insumoDetalhe.fatorPerda ?? 0)}
                      </p>
                    </div>
                    <div className="bg-card-2 border border-line rounded-xl p-2.5">
                      <p className="text-muted">Origem</p>
                      <p className="font-semibold text-ink mt-0.5">
                        {insumoDetalhe.produzidoInternamente
                          ? insumoDetalhe.validadeDias
                            ? `Da casa (${insumoDetalhe.validadeDias}d)`
                            : 'Da casa'
                          : 'Compra externa'}
                      </p>
                    </div>
                  </div>

                  <HistoricoMovimentacoes
                    key={insumoDetalhe.id}
                    insumoId={insumoDetalhe.id}
                    unidadeInsumo={insumoDetalhe.unidade}
                  />

                  {podeGerir && (
                    <div className="flex flex-col gap-2 pt-1">
                      <motion.button
                        type="button"
                        whileTap={tap}
                        aria-label={`Editar ${insumoDetalhe.nome}`}
                        onClick={() => iniciarEdicaoInsumo(insumoDetalhe)}
                        className="w-full bg-primary hover:bg-primary-deep text-on-primary rounded-xl font-bold text-sm cursor-pointer min-h-[44px] flex items-center justify-center gap-2 shadow-sm"
                      >
                        <PencilSimple size={18} weight="duotone" /> Editar
                      </motion.button>
                      <motion.button
                        type="button"
                        whileTap={tap}
                        disabled={excluindoInsumo}
                        aria-label={`Excluir ${insumoDetalhe.nome}`}
                        onClick={() => void executarExcluirInsumo(insumoDetalhe)}
                        className="w-full bg-danger-soft text-danger hover:brightness-95 disabled:opacity-50 rounded-xl font-semibold text-sm cursor-pointer min-h-[44px] flex items-center justify-center gap-2"
                      >
                        <Trash size={18} weight="duotone" /> {excluindoInsumo ? 'Excluindo...' : 'Excluir insumo'}
                      </motion.button>
                    </div>
                  )}
                </div>
              ) : (
                <form
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    void executarSalvarInsumo();
                  }}
                  className="space-y-3 pb-2"
                >
                <div>
                  <span id="categoria-insumo-label" className="text-xs text-muted ml-1">Categoria</span>
                  <div
                    role="radiogroup"
                    aria-labelledby="categoria-insumo-label"
                    className="grid grid-cols-3 gap-1.5 mt-1"
                  >
                    {CATEGORIAS_INSUMO.map((op) => {
                      const selecionada = formInsumo.categoria === op.valor;
                      return (
                        <label
                          key={op.valor}
                          className={`min-h-[44px] px-2 rounded-xl border text-xs font-semibold flex items-center justify-center cursor-pointer transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40 ${
                            selecionada
                              ? 'bg-primary text-on-primary border-primary shadow-sm'
                              : 'bg-field text-ink border-line hover:bg-card-2'
                          }`}
                        >
                          <input
                            type="radio"
                            name="categoria-insumo"
                            value={op.valor}
                            checked={selecionada}
                            onChange={() => {
                              const novaCategoria = op.valor;
                              const beneficiadoOriginal = !!insumoSelecionado?.produzidoInternamente;
                              setFormInsumo((prev) => ({
                                ...prev,
                                categoria: novaCategoria,
                                ...(!beneficiadoOriginal && novaCategoria !== 'INGREDIENTE'
                                  ? { produzidoInternamente: false, validadeDias: '' }
                                  : {}),
                              }));
                            }}
                            className="sr-only"
                          />
                          {op.rotulo}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    required
                    aria-label="Nome do insumo"
                    placeholder="Nome (ex: Maionese)"
                    value={formInsumo.nome}
                    onChange={e => setFormInsumo({...formInsumo, nome: e.target.value})}
                    className="flex-1 p-2 border border-line rounded-lg bg-field text-ink placeholder:text-faint min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <select
                    aria-label="Unidade de medida"
                    value={formInsumo.unidade}
                    onChange={e => setFormInsumo({...formInsumo, unidade: e.target.value})}
                    className="p-2 border border-line rounded-lg bg-field text-ink w-28 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    {opcoesUnidade(formInsumo.unidade).map(({ valor, rotulo }) => (
                      <option key={valor} value={valor}>{rotulo}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label htmlFor="estoque-atual-input" className="text-xs text-muted ml-1">
                      Estoque Atual {formInsumo.id && <span className="text-[10px] text-faint">(ajustado por movimentações)</span>}
                    </label>
                    <input
                      id="estoque-atual-input"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      placeholder="0"
                      aria-label="Estoque Atual"
                      disabled={!!formInsumo.id}
                      value={formInsumo.estoqueAtual}
                      onChange={e => setFormInsumo({...formInsumo, estoqueAtual: e.target.value === '' ? '' : Number(e.target.value)})}
                      className="w-full p-2 border border-line rounded-lg bg-field text-ink placeholder:text-faint disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div className="flex-1">
                    <label htmlFor="estoque-minimo-input" className="text-xs text-muted ml-1">Mínimo Seguro</label>
                    <input
                      id="estoque-minimo-input"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      placeholder="0"
                      aria-label="Mínimo Seguro"
                      value={formInsumo.estoqueMinimo}
                      onChange={e => setFormInsumo({...formInsumo, estoqueMinimo: e.target.value === '' ? '' : Number(e.target.value)})}
                      className="w-full p-2 border border-line rounded-lg bg-field text-ink placeholder:text-faint min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label htmlFor="custo-unitario-input" className="text-xs text-muted ml-1">Custo Unit. (R$)</label>
                    <input
                      id="custo-unitario-input"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.0001"
                      placeholder="0,00"
                      aria-label="Custo Unitário"
                      value={formInsumo.custoUnitario}
                      onChange={e => setFormInsumo({...formInsumo, custoUnitario: e.target.value === '' ? '' : Number(e.target.value)})}
                      className="w-full p-2 border border-line rounded-lg bg-field text-ink placeholder:text-faint min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div className="flex-1">
                    <label htmlFor="fator-perda-input" className="text-xs text-muted ml-1">Fator Perda (%)</label>
                    <input
                      id="fator-perda-input"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max="100"
                      step="0.1"
                      placeholder="0%"
                      aria-label="Fator Perda"
                      value={formInsumo.fatorPerdaPct}
                      onChange={e => setFormInsumo({...formInsumo, fatorPerdaPct: e.target.value === '' ? '' : Number(e.target.value)})}
                      className="w-full p-2 border border-line rounded-lg bg-field text-ink placeholder:text-faint min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>
                {(formInsumo.categoria === 'INGREDIENTE' || !!insumoSelecionado?.produzidoInternamente) && (
                  <>
                    <label className="flex items-center gap-2 text-sm text-ink ml-1 min-h-[44px] cursor-pointer">
                      <input
                        type="checkbox"
                        aria-label="Produzido na casa (item beneficiado)"
                        checked={formInsumo.produzidoInternamente}
                        onChange={e => {
                          const marcado = e.target.checked;
                          setFormInsumo(prev => ({
                            ...prev,
                            produzidoInternamente: marcado,
                            validadeDias: marcado ? prev.validadeDias : '',
                          }));
                        }}
                      />
                      Produzido na casa (item beneficiado)
                    </label>
                    {formInsumo.produzidoInternamente && (
                      <div>
                        <label htmlFor="validade-dias-input" className="text-xs text-muted ml-1">Validade (dias)</label>
                        <input
                          id="validade-dias-input"
                          type="number"
                          inputMode="numeric"
                          min="1"
                          step="1"
                          aria-label="Validade em dias"
                          value={formInsumo.validadeDias}
                          onChange={e => setFormInsumo({...formInsumo, validadeDias: e.target.value === '' ? '' : Number(e.target.value)})}
                          className="w-full p-2 border border-line rounded-lg bg-field text-ink min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      </div>
                    )}
                  </>
                )}
                
                <div className="flex gap-2 pt-2">
                  <motion.button
                    type="button"
                    whileTap={tap}
                    onClick={() => {
                      if (formInsumo.id && insumoSelecionado) {
                        setModoSheetInsumo('detalhes');
                      } else {
                        fecharSheetInsumo();
                      }
                    }}
                    className="flex-1 bg-field hover:bg-card-2 text-ink py-2 rounded-lg font-medium cursor-pointer min-h-[44px]"
                  >
                    Cancelar
                  </motion.button>
                  <motion.button
                    type="submit"
                    whileTap={tap}
                    disabled={salvandoInsumo}
                    className="flex-1 bg-primary hover:bg-primary-deep disabled:opacity-50 text-on-primary py-2 rounded-lg font-bold cursor-pointer min-h-[44px] shadow-sm"
                  >
                    {salvandoInsumo ? 'Salvando...' : 'Salvar'}
                  </motion.button>
                </div>
              </form>
              )}
            </Sheet>

            {/* Filtros de Insumos */}
            <div className="flex gap-2 overflow-x-auto pb-1 text-xs">
              <motion.button
                type="button"
                whileTap={tap}
                onClick={() => setFiltroInsumos('todos')}
                className={`px-3 py-1.5 rounded-full transition-colors whitespace-nowrap min-h-[44px] flex items-center ${
                  filtroInsumos === 'todos'
                    ? 'bg-primary text-on-primary font-bold shadow-sm'
                    : 'bg-field text-muted hover:text-ink font-medium'
                }`}
              >
                Todos ({insumosDaAba.length})
              </motion.button>
              {abaAtiva === 'insumos' && (
                <motion.button
                  type="button"
                  whileTap={tap}
                  onClick={() => setFiltroInsumos('beneficiados')}
                  className={`px-3 py-1.5 rounded-full transition-colors whitespace-nowrap flex items-center gap-1 min-h-[44px] ${
                    filtroInsumos === 'beneficiados'
                      ? 'bg-secondary text-on-secondary font-bold shadow-sm'
                      : 'bg-field text-muted hover:text-ink font-medium'
                  }`}
                >
                  <ChefHat size={14} weight="duotone" /> Preparo Interno ({insumosDaAba.filter(i => i.produzidoInternamente).length})
                </motion.button>
              )}
              <motion.button
                type="button"
                whileTap={tap}
                onClick={() => setFiltroInsumos('alertas')}
                className={`px-3 py-1.5 rounded-full transition-colors whitespace-nowrap flex items-center gap-1 min-h-[44px] ${
                  filtroInsumos === 'alertas'
                    ? 'bg-danger text-canvas font-bold shadow-sm'
                    : 'bg-field text-muted hover:text-ink font-medium'
                }`}
              >
                <Warning size={14} weight="duotone" /> Alertas ({totalAlertas})
              </motion.button>
            </div>

            {/* Lista Insumos Cards */}
            <div className="space-y-3">
              {carregandoInsumos && insumos.length === 0 && (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-20 rounded-xl bg-field animate-pulse" />
                  ))}
                </div>
              )}

              {!carregandoInsumos && insumosDaAba.length === 0 && (() => {
                const vazio = ESTADO_VAZIO_POR_ABA[abaAtiva as Exclude<AbaEstoque, 'produtos'>];
                return (
                  <EstadoVazio
                    titulo={vazio.titulo}
                    descricao={podeGerir ? vazio.descricao : undefined}
                    acao={podeGerir ? { texto: vazio.acao, onClick: abrirNovoInsumo } : undefined}
                  />
                );
              })()}

              {/* Com busca, o vazio é "nada encontrado"; as mensagens dos filtros abaixo só valem sem busca */}
              {insumosDaAba.length > 0 && termo && insumosFiltrados.length === 0 && (
                <EstadoVazio
                  titulo="Nenhum insumo encontrado"
                  descricao={`Nada corresponde a "${busca.trim()}"${filtroInsumos === 'todos' ? '' : ' neste filtro'}.`}
                />
              )}

              {insumosDaAba.length > 0 && !termo && filtroInsumos === 'alertas' && insumosFiltrados.length === 0 && (
                <EstadoVazio
                  titulo="Tudo em ordem por aqui"
                  descricao="Nenhum insumo abaixo do mínimo ou perto de vencer."
                />
              )}

              {insumosDaAba.length > 0 && !termo && abaAtiva === 'insumos' && filtroInsumos === 'beneficiados' && insumosFiltrados.length === 0 && (
                <EstadoVazio
                  titulo="Nenhum item de preparo interno"
                  descricao='Marque "Produzido internamente" ao cadastrar um insumo (ex.: maionese da casa) para controlar produção e validade.'
                />
              )}

              <motion.div
                variants={stagger}
                initial="hidden"
                animate="show"
                className="space-y-3"
              >
                {insumosFiltrados.map(insumo => {
                  const isCritico = estaCritico(insumo);
                  const val = calcularValidade(insumo);

                  return (
                    <motion.div
                      key={insumo.id}
                      variants={rise}
                      className={`bg-card rounded-xl border p-4 shadow-sm relative overflow-hidden transition-colors ${
                        val?.vencido
                          ? 'border-danger bg-danger-soft/20'
                          : isCritico || val?.alerta
                          ? 'border-brand/50'
                          : 'border-line'
                      }`}
                    >
                      {isCritico && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-danger"></div>}
                      {val?.vencido && !isCritico && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-danger"></div>}
                      {val?.alerta && !isCritico && !val.vencido && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-brand"></div>}
                      
                      <div className="flex justify-between items-start gap-2 pl-2">
                        <div className="flex-1 min-w-0 text-left">
                          <div>
                            <h3 className="font-semibold text-ink text-sm sm:text-base leading-snug break-words">
                              {insumo.nome}
                            </h3>
                            {insumo.produzidoInternamente && (
                              <div className="mt-1">
                                <span className="inline-flex items-center gap-1 bg-secondary-soft text-secondary text-[11px] font-semibold px-2 py-0.5 rounded-full">
                                  <CookingPot size={11} /> Da casa
                                </span>
                              </div>
                            )}
                          </div>

                          <div id={`insumo-resumo-${insumo.id}`}>
                            <p className="text-sm text-muted mt-1">
                              Estoque:{' '}
                              <span className={`font-bold whitespace-nowrap ${isCritico ? 'text-danger' : 'text-ink'}`}>
                                {formatarQuantidade(insumo.estoqueAtual, insumo.unidade)}
                              </span>
                            </p>

                            {isCritico && (
                              <p className="text-xs text-danger mt-0.5 flex items-center gap-1 font-medium">
                                <Warning size={12} weight="duotone" /> {insumo.estoqueAtual <= 0 ? 'Sem estoque' : `Abaixo do mínimo (${insumo.estoqueMinimo})`}
                              </p>
                            )}

                            {val?.vencido && (
                              <p className="text-xs text-danger font-bold mt-0.5 flex items-center gap-1">
                                <Warning size={12} weight="duotone" /> Vencido há {Math.abs(val.diasRestantes)} dia(s)!
                              </p>
                            )}

                            {val?.alerta && (
                              <p className="text-xs text-brand font-bold mt-0.5 flex items-center gap-1">
                                <Warning size={12} weight="duotone" /> Perto de vencer ({val.diasRestantes} dia(s) restante(s))
                              </p>
                            )}

                            {val && !val.vencido && !val.alerta && (
                              <p className="text-xs text-success mt-0.5 flex items-center gap-1 font-medium">
                                ✓ Válido por mais {val.diasRestantes} dia(s)
                              </p>
                            )}

                            {insumo.produzidoInternamente && !val && insumo.validadeDias && (
                              <p className="text-xs text-secondary mt-0.5 flex items-center gap-1">
                                <ChefHat size={12} weight="duotone" /> Produzido na casa • validade {insumo.validadeDias}d
                              </p>
                            )}

                            {/* Nível do estoque em relação ao mínimo (cheia = 2× o mínimo) */}
                            <div className="mt-2.5">
                              <div className="h-1.5 rounded-full bg-card-2 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${isCritico || val?.vencido ? 'bg-danger' : 'bg-success'}`}
                                  style={{
                                    width: `${
                                      insumo.estoqueMinimo > 0
                                        ? Math.min(insumo.estoqueAtual / (insumo.estoqueMinimo * 2), 1) * 100
                                        : insumo.estoqueAtual > 0 ? 100 : 0
                                    }%`,
                                  }}
                                />
                              </div>
                              <p className="text-[11px] text-muted mt-1">mínimo {formatarQuantidade(insumo.estoqueMinimo, insumo.unidade)}</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-1 items-center shrink-0">
                          {insumo.produzidoInternamente && (
                            <motion.button
                              type="button"
                              whileTap={tap}
                              onClick={() => setBeneficiadoSelecionadoId(insumo.id)}
                              title={podeGerir ? 'Produzir ou configurar sub-ficha' : 'Ver receita (sub-ficha)'}
                              aria-label={podeGerir ? `Produzir ${insumo.nome}` : `Ver receita de ${insumo.nome}`}
                              className="relative z-10 bg-secondary-soft hover:bg-secondary/20 text-secondary px-2 sm:px-2.5 py-1.5 rounded-lg flex items-center justify-center gap-1 text-xs font-semibold cursor-pointer min-h-[44px] min-w-[44px]"
                            >
                              <ChefHat size={16} weight="duotone" />
                              <span className="hidden sm:inline">{podeGerir ? 'Produzir' : 'Receita'}</span>
                            </motion.button>
                          )}
                          <button
                            type="button"
                            onClick={() => abrirDetalhesInsumo(insumo)}
                            aria-label={`Gerenciar ${insumo.nome}`}
                            aria-describedby={`insumo-resumo-${insumo.id}`}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-faint cursor-pointer focus:outline-none focus-visible:after:ring-2 focus-visible:after:ring-primary/40 after:absolute after:inset-0 after:rounded-xl after:content-['']"
                          >
                            <CaretRight size={18} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>

            {/* Ação principal da aba, fixa acima da barra inferior */}
            {podeGerir && (
              <div className="sticky bottom-20 pt-1 z-10">
                <motion.button
                  type="button"
                  whileTap={tap}
                  onClick={abrirNovoInsumo}
                  className="w-full bg-primary text-on-primary rounded-2xl min-h-[50px] font-bold flex items-center justify-center gap-2 shadow-primary cursor-pointer"
                >
                  <Plus size={20} weight="bold" /> Novo insumo
                </motion.button>
              </div>
            )}
          </div>
        )}

        {abaAtiva === 'produtos' && (
          <div role="tabpanel" id="panel-produtos" aria-labelledby="tab-produtos" className="space-y-3">
            <VendasRetidasPainel
              dados={retidasExibidas}
              onCorrigirItem={podeGerir ? (acao) => executarAcaoRetida(acao, produtos) : undefined}
              onCarregarMais={retidasExibidas?.temMais ? carregarMaisRetidas : undefined}
              carregandoMais={carregandoMaisRetidas}
            />
            <Sheet
              open={mostrarFormProduto}
              onClose={() => { setMostrarFormProduto(false); setNomeNovoProduto(''); setProdutoConflito(null); }}
              title="Novo produto"
              icon={<Hamburger size={22} weight="duotone" />}
            >
              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  void executarCriarProduto();
                }}
                className="space-y-3 pb-2"
              >
                <input
                  type="text"
                  autoFocus
                  required
                  aria-label="Nome do novo produto"
                  placeholder="Ex.: X-Bacon"
                  value={nomeNovoProduto}
                  onChange={(e) => {
                    setNomeNovoProduto(e.target.value);
                    if (produtoConflito) setProdutoConflito(null);
                  }}
                  className="w-full border border-line bg-field text-ink rounded-lg p-2.5 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/40"
                />

                {produtoConflito && (
                  <div className="p-3 rounded-lg border border-brand/40 bg-primary-soft/30 text-xs text-ink space-y-2">
                    <p>Já existe um produto com nome equivalente cadastrado: &quot;{produtoConflito.nome}&quot;.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setProdutoSelecionadoId(produtoConflito.id);
                        setProdutoConflito(null);
                        setMostrarFormProduto(false);
                      }}
                      className="font-semibold text-secondary hover:underline cursor-pointer flex items-center gap-1 min-h-[44px]"
                    >
                      Visualizar produto existente →
                    </button>
                  </div>
                )}

                <motion.button
                  type="submit"
                  whileTap={tap}
                  disabled={criandoProduto || !nomeNovoProduto.trim()}
                  className="w-full bg-primary hover:bg-primary-deep disabled:opacity-50 text-on-primary py-2.5 rounded-lg font-bold text-sm cursor-pointer min-h-[44px] shadow-sm"
                >
                  {criandoProduto ? 'Criando...' : 'Criar produto'}
                </motion.button>
              </form>
            </Sheet>

            {carregandoProdutos && produtos.length === 0 && (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-16 rounded-2xl bg-field animate-pulse" />
                ))}
              </div>
            )}
            {!carregandoProdutos && produtos.length === 0 && !mostrarFormProduto && (
              <EstadoVazio
                titulo="Nenhum produto cadastrado"
                descricao={
                  podeGerir
                    ? 'Crie os lanches do cardápio e monte a ficha técnica de cada um para o desconto automático de estoque.'
                    : undefined
                }
              />
            )}
            {produtos.length > 0 && termo && produtosFiltrados.length === 0 && (
              <EstadoVazio titulo="Nenhum produto encontrado" descricao={`Nada corresponde a "${busca.trim()}".`} />
            )}
            <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-2">
              {produtosFiltrados.map((prod) => (
                  <motion.div
                    key={prod.id}
                    variants={rise}
                    whileTap={tap}
                    onClick={() => setProdutoSelecionadoId(prod.id)}
                    className="bg-card border border-line rounded-3xl pl-3 pr-1 py-2 flex items-center gap-3 cursor-pointer hover:border-primary transition-colors"
                  >
                    <span className="w-10 h-10 rounded-xl bg-primary-soft text-brand flex items-center justify-center shrink-0">
                      <Hamburger size={22} weight="duotone" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ink line-clamp-2 break-words">{prod.nome}</p>
                      <p className="text-xs text-muted">Ficha técnica</p>
                    </div>
                    {podeGerir && (
                      <button
                        type="button"
                        onClick={(e) => deletarProduto(prod, e)}
                        className="text-faint hover:text-danger rounded-xl cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
                        title={`Excluir ${prod.nome}`}
                        aria-label={`Excluir ${prod.nome}`}
                      >
                        <Trash size={17} />
                      </button>
                    )}
                    <CaretRight size={18} className="text-faint shrink-0" />
                  </motion.div>
                ))}
            </motion.div>

            {podeGerir && (
              <div className="sticky bottom-20 pt-1 z-10">
                <motion.button
                  type="button"
                  whileTap={tap}
                  onClick={() => setMostrarFormProduto(true)}
                  className="w-full bg-primary text-on-primary rounded-2xl min-h-[50px] font-bold flex items-center justify-center gap-2 shadow-primary cursor-pointer"
                >
                  <Plus size={20} weight="bold" /> Novo produto
                </motion.button>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
