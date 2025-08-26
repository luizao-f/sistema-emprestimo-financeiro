import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Calendar, 
  TrendingUp, 
  ChevronLeft, 
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Users,
  DollarSign,
  Target,
  Loader2,
  Copy,
  Info,
  Percent
} from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, parseISO, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ParcelaCalculada {
  id: string;
  emprestimoId: string;
  devedor: string;
  valor: number;
  valorEmprestimo: number;
  taxaTotal: number;
  dataVencimento: Date;
  tipo: 'mensal' | 'trimestral' | 'anual';
  status: 'pendente' | 'pago' | 'atrasado';
  investidores: any[];
  taxaIntermediador: number;
  rendimentoIntermediador: number;
  rendimentoInvestidores: number;
  valorRecebido?: number;
}

interface ResumoMes {
  totalPrevisto: number;
  totalRecebido: number;
  totalPendente: number;
  rendimentoIntermediador: number;
  rendimentoInvestidores: number;
  porInvestidor: Record<string, {
    previsto: number;
    recebido: number;
    pendente: number;
    percentual: number;
  }>;
}

const Reports = () => {
  const [mesAtual, setMesAtual] = useState(new Date());
  const [emprestimos, setEmprestimos] = useState<any[]>([]);
  const [pagamentosRecebidos, setPagamentosRecebidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvandoPagamento, setSalvandoPagamento] = useState(false);
  const [modalPagamento, setModalPagamento] = useState<{
    aberto: boolean;
    parcela: ParcelaCalculada | null;
  }>({ aberto: false, parcela: null });
  const [valorPagamento, setValorPagamento] = useState('');
  const [distribuicaoPagamento, setDistribuicaoPagamento] = useState<{
    intermediador: number;
    investidores: Record<string, number>;
  }>({ intermediador: 0, investidores: {} });
  const { toast } = useToast();

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  // Função para aplicar máscara monetária
  const applyMoneyMask = (value: string) => {
    // Remove tudo que não é dígito
    const digits = value.replace(/\D/g, '');
    
    // Se não há dígitos, retorna vazio
    if (!digits) return '';
    
    // Converte para centavos
    const cents = parseInt(digits);
    
    // Formata como moeda
    return (cents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  // Função para converter valor mascarado para número
  const parseMoneyValue = (maskedValue: string): number => {
    if (!maskedValue) return 0;
    
    // Remove símbolos e converte vírgula para ponto
    const cleanValue = maskedValue
      .replace(/[R$\s]/g, '')
      .replace(/\./g, '')
      .replace(',', '.');
    
    return parseFloat(cleanValue) || 0;
  };

  const calcularDistribuicaoPagamento = (parcela: ParcelaCalculada, valorPago: number) => {
    if (!valorPago || valorPago <= 0) {
      return { intermediador: 0, investidores: {} };
    }

    // Calcular proporção do pagamento em relação ao valor total
    const proporcao = Math.min(valorPago / parcela.valor, 1);
    
    const intermediador = parcela.rendimentoIntermediador * proporcao;
    const investidores: Record<string, number> = {};

    if (parcela.investidores && parcela.investidores.length > 0) {
      // CORREÇÃO CRÍTICA: Usar arredondamento preciso para evitar discrepâncias
      let totalInvestidoresCalculado = 0;
      
      parcela.investidores.forEach((inv: any, index: number) => {
        if (index === parcela.investidores.length - 1) {
          // Último investidor recebe o restante para evitar erro de arredondamento
          investidores[inv.nome_parceiro] = (parcela.rendimentoInvestidores * proporcao) - totalInvestidoresCalculado;
        } else {
          const valorInvestidor = Math.round((parcela.rendimentoInvestidores * inv.percentual_participacao / 100) * proporcao * 100) / 100;
          investidores[inv.nome_parceiro] = valorInvestidor;
          totalInvestidoresCalculado += valorInvestidor;
        }
      });
    } else {
      investidores["Investidores"] = parcela.rendimentoInvestidores * proporcao;
    }

    return { intermediador, investidores };
  };

  const atualizarDistribuicao = (valorStr: string, parcela: ParcelaCalculada | null) => {
    const valor = parseMoneyValue(valorStr) || 0;
    if (parcela) {
      const distribuicao = calcularDistribuicaoPagamento(parcela, valor);
      setDistribuicaoPagamento(distribuicao);
    }
  };

  const calcularProximoPagamento = (dataEmprestimo: Date, tipoPagamento: string, numeroMes: number): Date => {
    const data = new Date(dataEmprestimo);
    
    switch (tipoPagamento) {
      case 'trimestral':
        data.setMonth(data.getMonth() + (numeroMes * 3));
        break;
      case 'anual':
        data.setFullYear(data.getFullYear() + numeroMes);
        break;
      default: // mensal
        data.setMonth(data.getMonth() + numeroMes);
        break;
    }
    
    return data;
  };

  const calcularParcelasDoMes = (emprestimos: any[], mes: Date): ParcelaCalculada[] => {
    const parcelas: ParcelaCalculada[] = [];
    const inicioMes = startOfMonth(mes);
    const fimMes = endOfMonth(mes);

    emprestimos.forEach(emprestimo => {
      if (emprestimo.status !== 'ativo') return;

      const dataEmprestimo = parseISO(emprestimo.data_emprestimo);
      const tipoPagamento = emprestimo.tipo_pagamento || 'mensal';
      
      let numeroMes = 0;
      let proximoPagamento = calcularProximoPagamento(dataEmprestimo, tipoPagamento, numeroMes);
      
      while (proximoPagamento <= fimMes && numeroMes < 120) {
        if (proximoPagamento >= inicioMes && proximoPagamento <= fimMes) {
          const taxaMensal = emprestimo.taxa_mensal || 0;
          const taxaIntermediador = emprestimo.taxa_intermediador || 0;
          const taxaInvestidores = taxaMensal - taxaIntermediador;
          
          let mesesAcumulados = 1;
          
          if (tipoPagamento === 'trimestral') {
            mesesAcumulados = 3;
          } else if (tipoPagamento === 'anual') {
            mesesAcumulados = 12;
          }
          
          const rendimentoTotal = emprestimo.valor_total * (taxaMensal / 100) * mesesAcumulados;
          const rendimentoIntermediador = emprestimo.valor_total * (taxaIntermediador / 100) * mesesAcumulados;
          const rendimentoInvestidores = emprestimo.valor_total * (taxaInvestidores / 100) * mesesAcumulados;

          const parcela: ParcelaCalculada = {
            id: `${emprestimo.id}-${numeroMes}`,
            emprestimoId: emprestimo.id,
            devedor: emprestimo.devedor,
            valor: rendimentoTotal,
            valorEmprestimo: emprestimo.valor_total,
            taxaTotal: taxaMensal,
            dataVencimento: proximoPagamento,
            tipo: tipoPagamento as 'mensal' | 'trimestral' | 'anual',
            status: 'pendente',
            investidores: emprestimo.emprestimo_parceiros || [],
            taxaIntermediador,
            rendimentoIntermediador,
            rendimentoInvestidores,
            valorRecebido: 0
          };

          const pagamentosEmprestimo = pagamentosRecebidos.filter(p => {
            if (p.emprestimo_id !== emprestimo.id) return false;
            
            const dataVencimentoPagamento = new Date(p.data_vencimento);
            return dataVencimentoPagamento.getMonth() === proximoPagamento.getMonth() &&
                   dataVencimentoPagamento.getFullYear() === proximoPagamento.getFullYear();
          });

          if (pagamentosEmprestimo.length > 0) {
            const valorTotalRecebido = pagamentosEmprestimo.reduce((sum, p) => 
              sum + (parseFloat(p.valor_recebido) || 0), 0);
            
            parcela.valorRecebido = valorTotalRecebido;
            
            if (valorTotalRecebido >= rendimentoTotal * 0.99) {
              parcela.status = 'pago';
            } else if (valorTotalRecebido > 0) {
              parcela.status = 'pendente';
            }
          } else if (proximoPagamento < new Date()) {
            parcela.status = 'atrasado';
          }

          parcelas.push(parcela);
        }
        
        numeroMes++;
        proximoPagamento = calcularProximoPagamento(dataEmprestimo, tipoPagamento, numeroMes);
      }
    });

    return parcelas.sort((a, b) => a.dataVencimento.getTime() - b.dataVencimento.getTime());
  };

  const resumoMes: ResumoMes = useMemo(() => {
    const parcelasMes = calcularParcelasDoMes(emprestimos, mesAtual);
    
    const totalPrevisto = parcelasMes.reduce((sum, p) => sum + p.valor, 0);
    const totalRecebido = parcelasMes.reduce((sum, p) => sum + (p.valorRecebido || 0), 0);
    const totalPendente = totalPrevisto - totalRecebido;
    
    const rendimentoIntermediador = parcelasMes.reduce((sum, p) => sum + p.rendimentoIntermediador, 0);
    const rendimentoInvestidores = parcelasMes.reduce((sum, p) => sum + p.rendimentoInvestidores, 0);

    const porInvestidor: Record<string, { previsto: number; recebido: number; pendente: number; percentual: number }> = {};
    
    parcelasMes.forEach(parcela => {
      if (parcela.investidores && parcela.investidores.length > 0) {
        // CORREÇÃO: Cálculo preciso dos percentuais
        let totalCalculado = 0;
        
        parcela.investidores.forEach((inv: any, index: number) => {
          const nome = inv.nome_parceiro;
          const percentual = inv.percentual_participacao;
          
          let valorPrevistoInvestidor: number;
          
          if (index === parcela.investidores.length - 1) {
            // Último investidor recebe o restante para evitar erro de arredondamento
            valorPrevistoInvestidor = parcela.rendimentoInvestidores - totalCalculado;
          } else {
            valorPrevistoInvestidor = Math.round((parcela.rendimentoInvestidores * percentual) / 100 * 100) / 100;
            totalCalculado += valorPrevistoInvestidor;
          }
          
          const valorRecebidoInvestidor = parcela.status === 'pago' ? valorPrevistoInvestidor : 
            (parcela.valorRecebido || 0) > 0 ? (valorPrevistoInvestidor * (parcela.valorRecebido || 0)) / parcela.valor : 0;
          
          if (!porInvestidor[nome]) {
            porInvestidor[nome] = { previsto: 0, recebido: 0, pendente: 0, percentual };
          }
          
          porInvestidor[nome].previsto += valorPrevistoInvestidor;
          porInvestidor[nome].recebido += valorRecebidoInvestidor;
          porInvestidor[nome].pendente = porInvestidor[nome].previsto - porInvestidor[nome].recebido;
        });
      }
    });

    return {
      totalPrevisto,
      totalRecebido,
      totalPendente,
      rendimentoIntermediador,
      rendimentoInvestidores,
      porInvestidor
    };
  }, [emprestimos, pagamentosRecebidos, mesAtual]);

  const parcelasDoMes = useMemo(() => {
    return calcularParcelasDoMes(emprestimos, mesAtual);
  }, [emprestimos, pagamentosRecebidos, mesAtual]);

  // Função para gerar resumo copiável
  const gerarResumoCopiavel = () => {
    const mesFormatado = format(mesAtual, 'MMMM yyyy', { locale: ptBR });
    const investidoresOrdenados = Object.entries(resumoMes.porInvestidor)
      .sort(([a], [b]) => a.localeCompare(b));

    let resumo = `RESUMO DE INVESTIMENTOS - ${mesFormatado.toUpperCase()}\n`;
    resumo += `${'='.repeat(50)}\n\n`;

    if (investidoresOrdenados.length === 0) {
      resumo += `Nenhum investimento programado para este mês.\n`;
    } else {
      investidoresOrdenados.forEach(([nome, dados]) => {
        resumo += `${nome}:\n`;
        resumo += `  • Tipo: ${parcelasDoMes.find(p => p.investidores.some((inv: any) => inv.nome_parceiro === nome))?.tipo || 'N/A'}\n`;
        resumo += `  • Valor: ${formatCurrency(dados.previsto)}\n`;
        resumo += `  • Status: ${dados.recebido >= dados.previsto * 0.99 ? 'PAGO' : dados.recebido > 0 ? 'PARCIAL' : 'PENDENTE'}\n\n`;
      });

      const totalInvestidores = investidoresOrdenados.reduce((sum, [, dados]) => sum + dados.previsto, 0);
      resumo += `TOTAL INVESTIDORES: ${formatCurrency(totalInvestidores)}\n`;
      resumo += `TOTAL RECEBIDO: ${formatCurrency(investidoresOrdenados.reduce((sum, [, dados]) => sum + dados.recebido, 0))}\n`;
      resumo += `PENDENTE: ${formatCurrency(investidoresOrdenados.reduce((sum, [, dados]) => sum + dados.pendente, 0))}\n`;
    }

    return resumo;
  };

  const copiarResumo = () => {
    const resumo = gerarResumoCopiavel();
    navigator.clipboard.writeText(resumo).then(() => {
      toast({
        title: "Resumo copiado!",
        description: "O resumo foi copiado para a área de transferência.",
      });
    }).catch(() => {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o resumo.",
        variant: "destructive",
      });
    });
  };

  const loadData = async () => {
    try {
      setLoading(true);
      // Simular dados para demonstração
      const mockEmprestimos = [
        {
          id: '1',
          devedor: 'Cleisson',
          valor_total: 100000,
          taxa_mensal: 3,
          taxa_intermediador: 0.8,
          tipo_pagamento: 'trimestral',
          status: 'ativo',
          data_emprestimo: '2025-02-01',
          emprestimo_parceiros: [
            { nome_parceiro: 'Luiz', percentual_participacao: 33.3 },
            { nome_parceiro: 'Ana', percentual_participacao: 33.3 },
            { nome_parceiro: 'Juan', percentual_participacao: 33.4 }
          ]
        }
      ];

      setEmprestimos(mockEmprestimos);
      setPagamentosRecebidos([]);

    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegistrarPagamento = async () => {
    if (!modalPagamento.parcela || !valorPagamento) {
      toast({
        title: "Dados incompletos",
        description: "Por favor, preencha o valor do pagamento.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSalvandoPagamento(true);
      const valor = parseMoneyValue(valorPagamento);
      const parcela = modalPagamento.parcela;

      const valorRestante = parcela.valor - (parcela.valorRecebido || 0);
      if (valor > valorRestante + 0.01) {
        toast({
          title: "Valor inválido",
          description: `O valor não pode ser maior que o restante a ser pago: ${formatCurrency(valorRestante)}`,
          variant: "destructive",
        });
        return;
      }

      // Simular sucesso
      toast({
        title: "Pagamento registrado",
        description: `Pagamento de ${formatCurrency(valor)} registrado com sucesso.`,
      });

      setModalPagamento({ aberto: false, parcela: null });
      setValorPagamento('');
      setDistribuicaoPagamento({ intermediador: 0, investidores: {} });
      
      await loadData();

    } catch (error: any) {
      console.error('Erro ao registrar pagamento:', error);
      toast({
        title: "Erro ao registrar pagamento",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSalvandoPagamento(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pago':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'atrasado':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      'pago': 'default',
      'atrasado': 'destructive',
      'pendente': 'secondary'
    };
    
    const labels: Record<string, string> = {
      'pago': 'PAGO',
      'atrasado': 'ATRASADO',
      'pendente': 'PENDENTE'
    };
    
    return <Badge variant={variants[status] || 'secondary'}>{labels[status] || status.toUpperCase()}</Badge>;
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground">Controle inteligente de recebimentos por período</p>
        </div>
        
        {/* Botão de Copiar Resumo */}
        <Button
          onClick={copiarResumo}
          className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
          disabled={Object.keys(resumoMes.porInvestidor).length === 0}
        >
          <Copy className="h-4 w-4" />
          Copiar Resumo
        </Button>
      </div>

      {/* Navegação de Mês */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setMesAtual(subMonths(mesAtual, 1))}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Mês Anterior
            </Button>
            
            <div className="text-center flex items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold">
                  {format(mesAtual, 'MMMM yyyy', { locale: ptBR })}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Baseado nas datas de vencimento dos empréstimos
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMesAtual(new Date())}
                className="flex items-center gap-2"
              >
                <Calendar className="h-4 w-4" />
                Hoje
              </Button>
            </div>
            
            <Button
              variant="outline"
              onClick={() => setMesAtual(addMonths(mesAtual, 1))}
              className="flex items-center gap-2"
            >
              Próximo Mês
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resumo do Mês */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Previsto</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(resumoMes.totalPrevisto)}
            </div>
            <p className="text-xs text-muted-foreground">
              {parcelasDoMes.length} parcela(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Já Recebido</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(resumoMes.totalRecebido)}
            </div>
            <p className="text-xs text-muted-foreground">
              {resumoMes.totalPrevisto > 0 ? ((resumoMes.totalRecebido / resumoMes.totalPrevisto) * 100).toFixed(1) : 0}% realizado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendente</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {formatCurrency(resumoMes.totalPendente)}
            </div>
            <p className="text-xs text-muted-foreground">
              A receber
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Intermediador</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {formatCurrency(resumoMes.rendimentoIntermediador)}
            </div>
            <p className="text-xs text-muted-foreground">
              Intermediação
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Investidores</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(resumoMes.rendimentoInvestidores)}
            </div>
            <p className="text-xs text-muted-foreground">
              Parceiros
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Parcelas do Mês */}
      <Card>
        <CardHeader>
          <CardTitle>Parcelas do Mês</CardTitle>
          <CardDescription>
            Empréstimos com vencimento em {format(mesAtual, 'MMMM yyyy', { locale: ptBR })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {parcelasDoMes.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-medium text-muted-foreground">
                Nenhuma parcela neste mês
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Não há vencimentos programados para este período.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {parcelasDoMes.map((parcela) => (
                <div
                  key={parcela.id}
                  className={`border-l-4 rounded-lg p-4 transition-colors ${
                    parcela.status === 'pago'
                      ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
                      : parcela.status === 'atrasado'
                      ? 'border-red-500 bg-red-50 dark:bg-red-950/20'
                      : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        {getStatusIcon(parcela.status)}
                        <h4 className="font-semibold text-xl">{parcela.devedor}</h4>
                        {getStatusBadge(parcela.status)}
                        {(parcela.valorRecebido || 0) > 0 && parcela.status !== 'pago' && (
                          <Badge variant="outline">
                            Recebido: {formatCurrency(parcela.valorRecebido || 0)}
                          </Badge>
                        )}
                      </div>

                      {/* Informações Sutis do Empréstimo */}
                      <div className="mb-4 p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg border border-dashed">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Info className="h-3 w-3" />
                            <span>Empréstimo: {formatCurrency(parcela.valorEmprestimo)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Percent className="h-3 w-3" />
                            <span>Taxa: {parcela.taxaTotal}% mensal</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>Tipo: {parcela.tipo}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Vencimento</p>
                          <p className="font-medium">
                            {format(parcela.dataVencimento, 'dd/MM/yyyy', { locale: ptBR })}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Rendimento Total</p>
                          <p className="font-bold text-lg">{formatCurrency(parcela.valor)}</p>
                          {(parcela.valorRecebido || 0) > 0 && (
                            <p className="text-sm text-green-600">
                              Recebido: {formatCurrency(parcela.valorRecebido || 0)}
                            </p>
                          )}
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Período Acumulado</p>
                          <p className="font-medium">
                            {parcela.tipo === 'trimestral' ? '3 meses' : 
                             parcela.tipo === 'anual' ? '12 meses' : '1 mês'}
                          </p>
                        </div>
                      </div>

                      {/* Distribuição */}
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
                        <h5 className="font-medium text-sm text-muted-foreground mb-3">Distribuição do Rendimento:</h5>
                        
                        {/* Intermediador */}
                        <div className="flex justify-between items-center py-2 border-b">
                          <span className="text-sm text-muted-foreground">Intermediador ({parcela.taxaIntermediador}% mensal)</span>
                          <span className="font-bold text-purple-600">
                            {formatCurrency(parcela.rendimentoIntermediador)}
                          </span>
                        </div>
                        
                        {/* Investidores */}
                        {parcela.investidores && parcela.investidores.length > 0 ? (
                          <>
                            {parcela.investidores.map((investidor: any, index: number) => {
                              let valorInvestidor: number;
                              
                              if (index === parcela.investidores.length - 1) {
                                // Último investidor recebe o restante para evitar erro de arredondamento
                                const totalCalculado = parcela.investidores.slice(0, -1).reduce((sum: number, inv: any) => {
                                  return sum + Math.round((parcela.rendimentoInvestidores * inv.percentual_participacao) / 100 * 100) / 100;
                                }, 0);
                                valorInvestidor = parcela.rendimentoInvestidores - totalCalculado;
                              } else {
                                valorInvestidor = Math.round((parcela.rendimentoInvestidores * investidor.percentual_participacao) / 100 * 100) / 100;
                              }
                              
                              return (
                                <div key={index} className="flex justify-between items-center py-2">
                                  <span className="text-sm">
                                    {investidor.nome_parceiro} ({investidor.percentual_participacao.toFixed(1)}%)
                                  </span>
                                  <span className="font-bold text-green-600">
                                    {formatCurrency(valorInvestidor)}
                                  </span>
                                </div>
                              );
                            })}
                          </>
                        ) : (
                          <div className="flex justify-between items-center py-2">
                            <span className="text-sm">Investidores</span>
                            <span className="font-bold text-green-600">
                              {formatCurrency(parcela.rendimentoInvestidores)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Botão de Ação */}
                    <div className="ml-4">
                      {parcela.status !== 'pago' && (
                        <Dialog
                          open={modalPagamento.aberto && modalPagamento.parcela?.id === parcela.id}
                          onOpenChange={(aberto) => {
                            if (aberto) {
                              setModalPagamento({ aberto: true, parcela });
                              const valorRestante = parcela.valor - (parcela.valorRecebido || 0);
                              setValorPagamento(formatCurrency(valorRestante));
                              const distribuicaoInicial = calcularDistribuicaoPagamento(parcela, valorRestante);
                              setDistribuicaoPagamento(distribuicaoInicial);
                            } else {
                              setModalPagamento({ aberto: false, parcela: null });
                              setValorPagamento('');
                              setDistribuicaoPagamento({ intermediador: 0, investidores: {} });
                            }
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button className="bg-blue-600 hover:bg-blue-700">
                              {(parcela.valorRecebido || 0) > 0 ? 'Registrar Mais' : 'Registrar Pagamento'}
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl">
                            <DialogHeader>
                              <DialogTitle>Registrar Pagamento</DialogTitle>
                              <DialogDescription>
                                Confirme o recebimento do pagamento de {parcela.devedor}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                                <div>
                                  <p className="text-sm text-muted-foreground">Devedor</p>
                                  <p className="font-medium">{parcela.devedor}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Vencimento</p>
                                  <p className="font-medium">
                                    {format(parcela.dataVencimento, 'dd/MM/yyyy', { locale: ptBR })}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Empréstimo Original</p>
                                  <p className="font-medium">{formatCurrency(parcela.valorEmprestimo)}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Taxa Total</p>
                                  <p className="font-medium">{parcela.taxaTotal}% mensal ({parcela.tipo})</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Rendimento Esperado</p>
                                  <p className="font-medium">{formatCurrency(parcela.valor)}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Período</p>
                                  <p className="font-medium">
                                    {parcela.tipo === 'trimestral' ? '3 meses' : 
                                     parcela.tipo === 'anual' ? '12 meses' : '1 mês'}
                                  </p>
                                </div>
                                {(parcela.valorRecebido || 0) > 0 && (
                                  <>
                                    <div>
                                      <p className="text-sm text-muted-foreground">Já Recebido</p>
                                      <p className="font-medium text-green-600">{formatCurrency(parcela.valorRecebido || 0)}</p>
                                    </div>
                                    <div>
                                      <p className="text-sm text-muted-foreground">Restante</p>
                                      <p className="font-medium text-yellow-600">{formatCurrency(parcela.valor - (parcela.valorRecebido || 0))}</p>
                                    </div>
                                  </>
                                )}
                              </div>
                              
                              <div>
                                <label className="block text-sm font-medium mb-2">
                                  Valor Recebido Agora
                                </label>
                                <Input
                                  value={valorPagamento}
                                  onChange={(e) => {
                                    const maskedValue = applyMoneyMask(e.target.value);
                                    const numericValue = parseMoneyValue(maskedValue);
                                    const valorMaximo = parcela.valor - (parcela.valorRecebido || 0);
                                    
                                    if (numericValue > valorMaximo) {
                                      toast({
                                        title: "Valor inválido",
                                        description: `O valor não pode ser maior que ${formatCurrency(valorMaximo)}`,
                                        variant: "destructive",
                                      });
                                      return;
                                    }
                                    
                                    setValorPagamento(maskedValue);
                                    atualizarDistribuicao(maskedValue, parcela);
                                  }}
                                  placeholder="R$ 0,00"
                                  className="text-lg font-mono"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                  Digite da direita para esquerda. Este valor será {(parcela.valorRecebido || 0) > 0 ? 'somado ao valor já recebido' : 'registrado como primeiro pagamento'}.
                                  Máximo: {formatCurrency(parcela.valor - (parcela.valorRecebido || 0))}
                                </p>
                              </div>

                              {/* Distribuição Detalhada */}
                              {parseMoneyValue(valorPagamento) > 0 && (
                                <div className="border rounded-lg p-4 bg-muted/50">
                                  <h4 className="font-medium text-sm mb-3">Distribuição do Pagamento:</h4>
                                  
                                  <div className="space-y-3">
                                    {/* Intermediador */}
                                    <div className="flex justify-between items-center p-3 bg-purple-50 dark:bg-purple-950/20 rounded border">
                                      <div className="flex items-center gap-2">
                                        <Target className="h-4 w-4 text-purple-600" />
                                        <span className="text-sm font-medium">Intermediador ({parcela.taxaIntermediador}% mensal)</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Input
                                          value={formatCurrency(distribuicaoPagamento.intermediador)}
                                          onChange={(e) => {
                                            const maskedValue = applyMoneyMask(e.target.value);
                                            const numericValue = parseMoneyValue(maskedValue);
                                            setDistribuicaoPagamento(prev => ({
                                              ...prev,
                                              intermediador: numericValue
                                            }));
                                          }}
                                          className="w-32 text-right text-sm font-mono"
                                        />
                                      </div>
                                    </div>

                                    {/* Investidores */}
                                    {Object.entries(distribuicaoPagamento.investidores).map(([nome, valor]) => {
                                      const investidor = parcela.investidores?.find((inv: any) => inv.nome_parceiro === nome);
                                      const percentual = investidor?.percentual_participacao || 100;
                                      
                                      return (
                                        <div key={nome} className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-950/20 rounded border">
                                          <div className="flex items-center gap-2">
                                            <Users className="h-4 w-4 text-green-600" />
                                            <span className="text-sm font-medium">
                                              {nome} ({percentual.toFixed(1)}%)
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <Input
                                              value={formatCurrency(valor)}
                                              onChange={(e) => {
                                                const maskedValue = applyMoneyMask(e.target.value);
                                                const numericValue = parseMoneyValue(maskedValue);
                                                setDistribuicaoPagamento(prev => ({
                                                  ...prev,
                                                  investidores: {
                                                    ...prev.investidores,
                                                    [nome]: numericValue
                                                  }
                                                }));
                                              }}
                                              className="w-32 text-right text-sm font-mono"
                                            />
                                          </div>
                                        </div>
                                      );
                                    })}

                                    {/* Totalizador */}
                                    <div className="border-t pt-2 mt-3">
                                      <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium">Total da Distribuição:</span>
                                        <span className="text-lg font-bold text-blue-600">
                                          {formatCurrency(
                                            distribuicaoPagamento.intermediador + 
                                            Object.values(distribuicaoPagamento.investidores).reduce((sum, val) => sum + val, 0)
                                          )}
                                        </span>
                                      </div>
                                      {Math.abs(
                                        (distribuicaoPagamento.intermediador + 
                                         Object.values(distribuicaoPagamento.investidores).reduce((sum, val) => sum + val, 0)) - 
                                        parseMoneyValue(valorPagamento)
                                      ) > 0.01 && (
                                        <p className="text-xs text-red-500 mt-1">
                                          ⚠️ A distribuição não confere com o valor total do pagamento
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}

                              <div className="flex space-x-2">
                                <Button
                                  onClick={handleRegistrarPagamento}
                                  disabled={salvandoPagamento}
                                  className="flex-1 bg-green-600 hover:bg-green-700"
                                >
                                  {salvandoPagamento ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Salvando...
                                    </>
                                  ) : (
                                    'Confirmar Recebimento'
                                  )}
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setModalPagamento({ aberto: false, parcela: null });
                                    setValorPagamento('');
                                    setDistribuicaoPagamento({ intermediador: 0, investidores: {} });
                                  }}
                                  className="flex-1"
                                  disabled={salvandoPagamento}
                                >
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumo Copiável */}
      {Object.keys(resumoMes.porInvestidor).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5" />
              Resumo para Investidores
            </CardTitle>
            <CardDescription>
              Resumo formatado para copiar e enviar aos investidores
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg font-mono text-sm whitespace-pre-wrap">
              {gerarResumoCopiavel()}
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={copiarResumo} className="flex items-center gap-2">
                <Copy className="h-4 w-4" />
                Copiar Resumo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Distribuição por Investidor */}
      {Object.keys(resumoMes.porInvestidor).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Investidor</CardTitle>
            <CardDescription>
              Breakdown de rendimentos por parceiro investidor no mês (valores corrigidos)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(resumoMes.porInvestidor)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([nome, valores]) => (
                <div key={nome} className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-green-600" />
                      <h4 className="font-semibold text-lg">{nome}</h4>
                      <Badge variant="outline" className="text-xs">
                        {valores.percentual.toFixed(1)}%
                      </Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Previsto:</span>
                        <p className="font-bold text-blue-600">{formatCurrency(valores.previsto)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Recebido:</span>
                        <p className="font-bold text-green-600">{formatCurrency(valores.recebido)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Pendente:</span>
                        <p className="font-bold text-yellow-600">{formatCurrency(valores.pendente)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-sm text-muted-foreground">Progresso</div>
                    <div className="font-bold text-xl text-blue-600">
                      {valores.previsto > 0 ? ((valores.recebido / valores.previsto) * 100).toFixed(1) : 0}%
                    </div>
                    <div className="w-24 bg-gray-200 rounded-full h-2 mt-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full transition-all duration-300" 
                        style={{ 
                          width: `${valores.previsto > 0 ? Math.min((valores.recebido / valores.previsto) * 100, 100) : 0}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Reports;