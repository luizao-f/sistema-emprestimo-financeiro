import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/StatusBadge';
import { supabase } from '@/integrations/supabase/client';
import { Emprestimo, Recebimento } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { 
  DollarSign, 
  TrendingUp, 
  Calendar, 
  Users,
  Loader2,
  PieChart,
  ArrowUp,
  ArrowDown,
  Target,
  Building,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  TrendingDown,
  Activity,
  BarChart3,
  Zap
} from 'lucide-react';
import { format, differenceInMonths, addMonths, parseISO, isAfter, isBefore, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DashboardStats {
  // Métricas Principais
  totalEmprestado: number;
  rendimentoMensalAtual: number;
  rendimentoTotalAcumulado: number;
  rendimentoIntermediadorAcumulado: number;
  rendimentoInvestidoresAcumulado: number;
  mediaRendimentoMensal: number;
  
  // Projeções (6 meses)
  projecaoProximos6Meses: number;
  projecaoIntermediador6Meses: number;
  projecaoInvestidores6Meses: number;
  
  // Contadores
  emprestimosAtivos: number;
  totalInvestidores: number;
  totalDevedores: number;
  
  // Inadimplência
  totalAtrasado: number;
  quantidadeAtrasados: number;
  valorAtrasadoIntermediador: number;
  valorAtrasadoInvestidores: number;
  
  // Performance
  roiMedio: number;
  taxaMediaPonderada: number;
  tempoMedioInvestimento: number;
}

interface InvestidorDetalhado {
  nome: string;
  totalInvestido: number;
  rendimentoMensal: number;
  rendimentoAcumulado: number;
  emprestimosAtivos: number;
  taxaEfetiva: number;
  participacaoTotal: number;
  roiAcumulado: number;
  projecao6Meses: number;
  valorAtrasado: number;
  emprestimos: Array<{
    devedor: string;
    valor: number;
    taxa: number;
    rendimento: number;
    status: string;
    mesesAtivos: number;
  }>;
}

interface DevedorDetalhado {
  devedor: string;
  totalEmprestado: number;
  rendimentoMensal: number;
  rendimentoAcumulado: number;
  emprestimosAtivos: number;
  taxaMedia: number;
  status: 'em_dia' | 'atrasado' | 'parcialmente_atrasado';
  valorAtrasado: number;
  diasAtraso: number;
  proximoVencimento: Date | null;
  valorProximoVencimento: number;
  historicoPagamentos: number; // % de pontualidade
}

interface ProjecaoMensal {
  mes: Date;
  totalPrevisto: number;
  intermediador: number;
  investidores: Array<{
    nome: string;
    valor: number;
  }>;
}

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalEmprestado: 0,
    rendimentoMensalAtual: 0,
    rendimentoTotalAcumulado: 0,
    rendimentoIntermediadorAcumulado: 0,
    rendimentoInvestidoresAcumulado: 0,
    mediaRendimentoMensal: 0,
    projecaoProximos6Meses: 0,
    projecaoIntermediador6Meses: 0,
    projecaoInvestidores6Meses: 0,
    emprestimosAtivos: 0,
    totalInvestidores: 0,
    totalDevedores: 0,
    totalAtrasado: 0,
    quantidadeAtrasados: 0,
    valorAtrasadoIntermediador: 0,
    valorAtrasadoInvestidores: 0,
    roiMedio: 0,
    taxaMediaPonderada: 0,
    tempoMedioInvestimento: 0
  });
  
  const [investidoresDetalhados, setInvestidoresDetalhados] = useState<InvestidorDetalhado[]>([]);
  const [devedoresDetalhados, setDevedoresDetalhados] = useState<DevedorDetalhado[]>([]);
  const [projecoesMensais, setProjecoesMensais] = useState<ProjecaoMensal[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const calcularProjecao6Meses = (emprestimos: any[]) => {
    const projecoes: ProjecaoMensal[] = [];
    
    for (let i = 0; i < 6; i++) {
      const mesProjecao = addMonths(new Date(), i);
      const inicioMes = startOfMonth(mesProjecao);
      const fimMes = endOfMonth(mesProjecao);
      
      let totalPrevisto = 0;
      let intermediadorTotal = 0;
      const investidoresMap = new Map<string, number>();
      
      emprestimos.forEach(emprestimo => {
        if (emprestimo.status !== 'ativo') return;
        
        const dataInicio = parseISO(emprestimo.data_emprestimo);
        const tipoPagamento = emprestimo.tipo_pagamento || 'mensal';
        
        // Verificar se há vencimento neste mês
        let temVencimento = false;
        
        if (tipoPagamento === 'mensal') {
          temVencimento = true;
        } else if (tipoPagamento === 'trimestral') {
          const mesesDesdeCriacao = differenceInMonths(mesProjecao, dataInicio);
          temVencimento = mesesDesdeCriacao % 3 === 0;
        } else if (tipoPagamento === 'anual') {
          const mesesDesdeCriacao = differenceInMonths(mesProjecao, dataInicio);
          temVencimento = mesesDesdeCriacao % 12 === 0;
        }
        
        if (temVencimento) {
          const taxaMensal = emprestimo.taxa_mensal || 0;
          const taxaIntermediador = emprestimo.taxa_intermediador || 0;
          const taxaInvestidores = taxaMensal - taxaIntermediador;
          
          let mesesAcumulados = 1;
          if (tipoPagamento === 'trimestral') mesesAcumulados = 3;
          if (tipoPagamento === 'anual') mesesAcumulados = 12;
          
          const rendimentoTotal = emprestimo.valor_total * (taxaMensal / 100) * mesesAcumulados;
          const rendimentoIntermediador = emprestimo.valor_total * (taxaIntermediador / 100) * mesesAcumulados;
          const rendimentoInvestidores = emprestimo.valor_total * (taxaInvestidores / 100) * mesesAcumulados;
          
          totalPrevisto += rendimentoTotal;
          intermediadorTotal += rendimentoIntermediador;
          
          // Distribuir por investidor
          if (emprestimo.emprestimo_parceiros && emprestimo.emprestimo_parceiros.length > 0) {
            emprestimo.emprestimo_parceiros.forEach((parceiro: any) => {
              const valorParceiro = (rendimentoInvestidores * parceiro.percentual_participacao) / 100;
              const nomeAtual = investidoresMap.get(parceiro.nome_parceiro) || 0;
              investidoresMap.set(parceiro.nome_parceiro, nomeAtual + valorParceiro);
            });
          }
        }
      });
      
      projecoes.push({
        mes: mesProjecao,
        totalPrevisto,
        intermediador: intermediadorTotal,
        investidores: Array.from(investidoresMap.entries()).map(([nome, valor]) => ({ nome, valor }))
      });
    }
    
    return projecoes;
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Carregar empréstimos com parceiros
      const { data: loans, error: loansError } = await supabase
        .from('emprestimos')
        .select(`
          *,
          emprestimo_parceiros:emprestimo_parceiros(*)
        `)
        .order('created_at', { ascending: false });

      if (loansError) throw loansError;

      // Carregar pagamentos para análise de inadimplência
      const { data: payments, error: paymentsError } = await supabase
        .from('recebimentos')
        .select('*');

      if (paymentsError) throw paymentsError;

      const activeLoans = loans?.filter(loan => loan.status === 'ativo') || [];
      
      // Calcular métricas principais
      const totalEmprestado = activeLoans.reduce((sum, loan) => sum + (loan.valor_total || 0), 0);
      const rendimentoMensalAtual = activeLoans.reduce((sum, loan) => sum + (loan.rendimento_total || loan.rendimento_mensal || 0), 0);
      
      // Calcular rendimentos acumulados desde o início
      let rendimentoTotalAcumulado = 0;
      let rendimentoIntermediadorAcumulado = 0;
      let rendimentoInvestidoresAcumulado = 0;
      let somaTempoInvestimento = 0;
      
      activeLoans.forEach(loan => {
        const mesesAtivo = Math.max(differenceInMonths(new Date(), parseISO(loan.data_emprestimo)), 1);
        const rendimentoMensal = loan.rendimento_total || loan.rendimento_mensal || 0;
        const rendimentoIntermediador = loan.rendimento_intermediador || 0;
        const rendimentoInvestidores = rendimentoMensal - rendimentoIntermediador;
        
        rendimentoTotalAcumulado += rendimentoMensal * mesesAtivo;
        rendimentoIntermediadorAcumulado += rendimentoIntermediador * mesesAtivo;
        rendimentoInvestidoresAcumulado += rendimentoInvestidores * mesesAtivo;
        somaTempoInvestimento += mesesAtivo;
      });
      
      const mediaRendimentoMensal = activeLoans.length > 0 ? rendimentoTotalAcumulado / (somaTempoInvestimento || 1) : 0;
      const tempoMedioInvestimento = activeLoans.length > 0 ? somaTempoInvestimento / activeLoans.length : 0;
      
      // Calcular projeções 6 meses
      const projecoes = calcularProjecao6Meses(activeLoans);
      const projecaoProximos6Meses = projecoes.reduce((sum, p) => sum + p.totalPrevisto, 0);
      const projecaoIntermediador6Meses = projecoes.reduce((sum, p) => sum + p.intermediador, 0);
      const projecaoInvestidores6Meses = projecaoProximos6Meses - projecaoIntermediador6Meses;
      
      // Calcular inadimplência (simplificado - seria necessário lógica mais complexa)
      let totalAtrasado = 0;
      let quantidadeAtrasados = 0;
      let valorAtrasadoIntermediador = 0;
      let valorAtrasadoInvestidores = 0;
      
      // Análise por investidor
      const investidoresMap = new Map<string, InvestidorDetalhado>();
      
      activeLoans.forEach(loan => {
        const mesesAtivo = Math.max(differenceInMonths(new Date(), parseISO(loan.data_emprestimo)), 1);
        const taxaInvestidores = (loan.taxa_total || loan.taxa_mensal) - (loan.taxa_intermediador || 0);
        const rendimentoMensal = loan.rendimento_total || loan.rendimento_mensal || 0;
        const rendimentoIntermediador = loan.rendimento_intermediador || 0;
        const rendimentoInvestidores = rendimentoMensal - rendimentoIntermediador;
        
        if (loan.emprestimo_parceiros && loan.emprestimo_parceiros.length > 0) {
          loan.emprestimo_parceiros.forEach((parceiro: any) => {
            const nome = parceiro.nome_parceiro;
            const valorInvestido = parceiro.valor_investido;
            const rendimentoMensalParceiro = (valorInvestido * taxaInvestidores) / 100;
            const rendimentoAcumuladoParceiro = rendimentoMensalParceiro * mesesAtivo;
            const roiAcumulado = valorInvestido > 0 ? (rendimentoAcumuladoParceiro / valorInvestido) * 100 : 0;
            
            if (!investidoresMap.has(nome)) {
              investidoresMap.set(nome, {
                nome,
                totalInvestido: 0,
                rendimentoMensal: 0,
                rendimentoAcumulado: 0,
                emprestimosAtivos: 0,
                taxaEfetiva: 0,
                participacaoTotal: 0,
                roiAcumulado: 0,
                projecao6Meses: 0,
                valorAtrasado: 0,
                emprestimos: []
              });
            }
            
            const investidor = investidoresMap.get(nome)!;
            investidor.totalInvestido += valorInvestido;
            investidor.rendimentoMensal += rendimentoMensalParceiro;
            investidor.rendimentoAcumulado += rendimentoAcumuladoParceiro;
            investidor.emprestimosAtivos += 1;
            investidor.emprestimos.push({
              devedor: loan.devedor,
              valor: valorInvestido,
              taxa: taxaInvestidores,
              rendimento: rendimentoMensalParceiro,
              status: loan.status,
              mesesAtivos: mesesAtivo
            });
            
            // Calcular projeção 6 meses para este investidor
            projecoes.forEach(projecao => {
              const investidorProjecao = projecao.investidores.find(i => i.nome === nome);
              if (investidorProjecao) {
                investidor.projecao6Meses += investidorProjecao.valor;
              }
            });
          });
        } else {
          // Handle old loans without detailed partners
          if (loan.valor_seu && loan.valor_seu > 0) {
            const nome = "Você";
            if (!investidoresMap.has(nome)) {
              investidoresMap.set(nome, {
                nome,
                totalInvestido: 0,
                rendimentoMensal: 0,
                rendimentoAcumulado: 0,
                emprestimosAtivos: 0,
                taxaEfetiva: 0,
                participacaoTotal: 0,
                roiAcumulado: 0,
                projecao6Meses: 0,
                valorAtrasado: 0,
                emprestimos: []
              });
            }
            const investidor = investidoresMap.get(nome)!;
            investidor.totalInvestido += loan.valor_seu;
            investidor.rendimentoMensal += loan.seu_rendimento || 0;
            investidor.rendimentoAcumulado += (loan.seu_rendimento || 0) * mesesAtivo;
            investidor.emprestimosAtivos += 1;
          }
          
          if (loan.valor_parceiro && loan.valor_parceiro > 0) {
            const nome = "Parceiro";
            if (!investidoresMap.has(nome)) {
              investidoresMap.set(nome, {
                nome,
                totalInvestido: 0,
                rendimentoMensal: 0,
                rendimentoAcumulado: 0,
                emprestimosAtivos: 0,
                taxaEfetiva: 0,
                participacaoTotal: 0,
                roiAcumulado: 0,
                projecao6Meses: 0,
                valorAtrasado: 0,
                emprestimos: []
              });
            }
            const investidor = investidoresMap.get(nome)!;
            investidor.totalInvestido += loan.valor_parceiro;
            investidor.rendimentoMensal += loan.parceiro_rendimento || 0;
            investidor.rendimentoAcumulado += (loan.parceiro_rendimento || 0) * mesesAtivo;
            investidor.emprestimosAtivos += 1;
          }
        }
      });

      // Atualizar métricas dos investidores
      investidoresMap.forEach((investidor) => {
        investidor.participacaoTotal = (investidor.totalInvestido / totalEmprestado) * 100;
        investidor.taxaEfetiva = investidor.totalInvestido > 0 ? (investidor.rendimentoMensal / investidor.totalInvestido) * 100 : 0;
        investidor.roiAcumulado = investidor.totalInvestido > 0 ? (investidor.rendimentoAcumulado / investidor.totalInvestido) * 100 : 0;
      });

      // Análise por devedor
      const devedoresMap = new Map<string, DevedorDetalhado>();
      
      activeLoans.forEach(loan => {
        const devedor = loan.devedor;
        const mesesAtivo = Math.max(differenceInMonths(new Date(), parseISO(loan.data_emprestimo)), 1);
        const rendimentoMensal = loan.rendimento_total || loan.rendimento_mensal || 0;
        const rendimentoAcumulado = rendimentoMensal * mesesAtivo;
        
        if (!devedoresMap.has(devedor)) {
          devedoresMap.set(devedor, {
            devedor,
            totalEmprestado: 0,
            rendimentoMensal: 0,
            rendimentoAcumulado: 0,
            emprestimosAtivos: 0,
            taxaMedia: 0,
            status: 'em_dia',
            valorAtrasado: 0,
            diasAtraso: 0,
            proximoVencimento: null,
            valorProximoVencimento: 0,
            historicoPagamentos: 100
          });
        }
        
        const devedorData = devedoresMap.get(devedor)!;
        devedorData.totalEmprestado += loan.valor_total;
        devedorData.rendimentoMensal += rendimentoMensal;
        devedorData.rendimentoAcumulado += rendimentoAcumulado;
        devedorData.emprestimosAtivos += 1;
        devedorData.taxaMedia = (devedorData.rendimentoMensal / devedorData.totalEmprestado) * 100;
      });

      // Calcular ROI médio
      const roiMedio = totalEmprestado > 0 ? (rendimentoTotalAcumulado / totalEmprestado) * 100 : 0;
      const taxaMediaPonderada = totalEmprestado > 0 ? (rendimentoMensalAtual / totalEmprestado) * 100 : 0;

      const finalStats: DashboardStats = {
        totalEmprestado,
        rendimentoMensalAtual,
        rendimentoTotalAcumulado,
        rendimentoIntermediadorAcumulado,
        rendimentoInvestidoresAcumulado,
        mediaRendimentoMensal,
        projecaoProximos6Meses,
        projecaoIntermediador6Meses,
        projecaoInvestidores6Meses,
        emprestimosAtivos: activeLoans.length,
        totalInvestidores: investidoresMap.size,
        totalDevedores: devedoresMap.size,
        totalAtrasado,
        quantidadeAtrasados,
        valorAtrasadoIntermediador,
        valorAtrasadoInvestidores,
        roiMedio,
        taxaMediaPonderada,
        tempoMedioInvestimento
      };

      setStats(finalStats);
      setInvestidoresDetalhados(Array.from(investidoresMap.values()).sort((a, b) => b.rendimentoMensal - a.rendimentoMensal));
      setDevedoresDetalhados(Array.from(devedoresMap.values()).sort((a, b) => b.rendimentoMensal - a.rendimentoMensal));
      setProjecoesMensais(projecoes);

    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
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
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral inteligente dos seus investimentos</p>
      </div>

      {/* Métricas Principais - Linha 1 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Emprestado</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(stats.totalEmprestado)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.emprestimosAtivos} empréstimos ativos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rendimento Acumulado</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(stats.rendimentoTotalAcumulado)}
            </div>
            <p className="text-xs text-muted-foreground">
              ROI: {formatPercent(stats.roiMedio)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rendimento Intermediador</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {formatCurrency(stats.rendimentoIntermediadorAcumulado)}
            </div>
            <p className="text-xs text-muted-foreground">
              Mensal: {formatCurrency(stats.rendimentoMensalAtual - (stats.rendimentoInvestidoresAcumulado / Math.max(stats.tempoMedioInvestimento, 1)))}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rendimento Investidores</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(stats.rendimentoInvestidoresAcumulado)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.totalInvestidores} investidores ativos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Projeção 6 Meses */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Projeção 6 Meses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(stats.projecaoProximos6Meses)}
            </div>
            <p className="text-xs text-muted-foreground">
              Média: {formatCurrency(stats.projecaoProximos6Meses / 6)}/mês
            </p>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 dark:bg-purple-950/20 border-purple-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Projeção Intermediador</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {formatCurrency(stats.projecaoIntermediador6Meses)}
            </div>
            <p className="text-xs text-muted-foreground">
              Média: {formatCurrency(stats.projecaoIntermediador6Meses / 6)}/mês
            </p>
          </CardContent>
        </Card>

        <Card className="bg-orange-50 dark:bg-orange-950/20 border-orange-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Projeção Investidores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(stats.projecaoInvestidores6Meses)}
            </div>
            <p className="text-xs text-muted-foreground">
              Média: {formatCurrency(stats.projecaoInvestidores6Meses / 6)}/mês
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas de Inadimplência */}
      {(stats.totalAtrasado > 0 || stats.quantidadeAtrasados > 0) && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardHeader>
            <CardTitle className="text-red-800 dark:text-red-200 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Alertas de Inadimplência
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.quantidadeAtrasados}</div>
                <div className="text-sm text-red-700">Empréstimos atrasados</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{formatCurrency(stats.totalAtrasado)}</div>
                <div className="text-sm text-red-700">Valor total atrasado</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{formatCurrency(stats.valorAtrasadoIntermediador)}</div>
                <div className="text-sm text-red-700">Intermediador atrasado</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{formatCurrency(stats.valorAtrasadoInvestidores)}</div>
                <div className="text-sm text-red-700">Investidores atrasado</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Análises Detalhadas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Investidores Detalhados */}
        <Card>
          <CardHeader>
            <CardTitle>Análise Detalhada por Investidor</CardTitle>
            <CardDescription>
              Performance completa de cada parceiro
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {investidoresDetalhados.map((investidor, index) => (
                <div key={investidor.nome} className="border rounded-lg p-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="font-bold text-lg">{investidor.nome}</div>
                      <Badge variant="outline">{formatPercent(investidor.participacaoTotal)}</Badge>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-600">
                        {formatCurrency(investidor.rendimentoAcumulado)}
                      </div>
                      <div className="text-sm text-muted-foreground">Acumulado</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-sm">
                    <div className="text-center bg-white dark:bg-gray-800 rounded p-2">
                      <div className="font-semibold">{formatCurrency(investidor.totalInvestido)}</div>
                      <div className="text-muted-foreground">Capital</div>
                    </div>
                    <div className="text-center bg-white dark:bg-gray-800 rounded p-2">
                      <div className="font-semibold text-green-600">{formatCurrency(investidor.rendimentoMensal)}</div>
                      <div className="text-muted-foreground">Mensal</div>
                    </div>
                    <div className="text-center bg-white dark:bg-gray-800 rounded p-2">
                      <div className="font-semibold text-blue-600">{formatPercent(investidor.taxaEfetiva)}</div>
                      <div className="text-muted-foreground">Taxa</div>
                    </div>
                    <div className="text-center bg-white dark:bg-gray-800 rounded p-2">
                      <div className="font-semibold text-purple-600">{formatPercent(investidor.roiAcumulado)}</div>
                      <div className="text-muted-foreground">ROI</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Projeção 6 meses:</span>
                      <span className="font-semibold text-blue-600">{formatCurrency(investidor.projecao6Meses)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Empréstimos ativos:</span>
                      <span className="font-semibold">{investidor.emprestimosAtivos}</span>
                    </div>
                    {investidor.valorAtrasado > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-red-600">Valor atrasado:</span>
                        <span className="font-semibold text-red-600">{formatCurrency(investidor.valorAtrasado)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Devedores Detalhados */}
        <Card>
          <CardHeader>
            <CardTitle>Análise Detalhada por Devedor</CardTitle>
            <CardDescription>
              Performance e status de cada cliente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {devedoresDetalhados.map((devedor, index) => (
                <div key={devedor.devedor} className={`border rounded-lg p-4 ${
                  devedor.status === 'atrasado' ? 'bg-red-50 dark:bg-red-950/20 border-red-200' :
                  devedor.status === 'parcialmente_atrasado' ? 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200' :
                  'bg-gray-50 dark:bg-gray-950/20'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="font-bold text-lg">{devedor.devedor}</div>
                      <Badge variant={
                        devedor.status === 'atrasado' ? 'destructive' :
                        devedor.status === 'parcialmente_atrasado' ? 'secondary' : 'default'
                      }>
                        {devedor.status === 'em_dia' ? 'Em dia' :
                         devedor.status === 'atrasado' ? 'Atrasado' : 'Parcial'}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-blue-600">
                        {formatCurrency(devedor.rendimentoAcumulado)}
                      </div>
                      <div className="text-sm text-muted-foreground">Gerado</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-sm">
                    <div className="text-center bg-white dark:bg-gray-800 rounded p-2">
                      <div className="font-semibold">{formatCurrency(devedor.totalEmprestado)}</div>
                      <div className="text-muted-foreground">Emprestado</div>
                    </div>
                    <div className="text-center bg-white dark:bg-gray-800 rounded p-2">
                      <div className="font-semibold text-green-600">{formatCurrency(devedor.rendimentoMensal)}</div>
                      <div className="text-muted-foreground">Mensal</div>
                    </div>
                    <div className="text-center bg-white dark:bg-gray-800 rounded p-2">
                      <div className="font-semibold text-blue-600">{formatPercent(devedor.taxaMedia)}</div>
                      <div className="text-muted-foreground">Taxa</div>
                    </div>
                    <div className="text-center bg-white dark:bg-gray-800 rounded p-2">
                      <div className="font-semibold">{devedor.emprestimosAtivos}</div>
                      <div className="text-muted-foreground">Ativos</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Histórico pagamentos:</span>
                      <span className={`font-semibold ${devedor.historicoPagamentos >= 95 ? 'text-green-600' : 
                        devedor.historicoPagamentos >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {formatPercent(devedor.historicoPagamentos)}
                      </span>
                    </div>
                    {devedor.valorAtrasado > 0 && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-red-600">Valor atrasado:</span>
                          <span className="font-semibold text-red-600">{formatCurrency(devedor.valorAtrasado)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-red-600">Dias em atraso:</span>
                          <span className="font-semibold text-red-600">{devedor.diasAtraso}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projeção Mensal Detalhada */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Calendário de Recebimentos - Próximos 6 Meses
          </CardTitle>
          <CardDescription>
            Projeção detalhada mês a mês com distribuição por investidor
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projecoesMensais.map((projecao, index) => (
              <div key={index} className="border rounded-lg p-4 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
                <div className="font-semibold text-lg mb-3">
                  {format(projecao.mes, 'MMMM yyyy', { locale: ptBR })}
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-2 bg-white dark:bg-gray-800 rounded">
                    <span className="text-sm font-medium">Total Previsto</span>
                    <span className="font-bold text-blue-600">{formatCurrency(projecao.totalPrevisto)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-2 bg-purple-50 dark:bg-purple-950/20 rounded">
                    <span className="text-sm font-medium">Intermediador</span>
                    <span className="font-bold text-purple-600">{formatCurrency(projecao.intermediador)}</span>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-muted-foreground">Investidores:</div>
                    {projecao.investidores.map((inv, invIndex) => (
                      <div key={invIndex} className="flex justify-between items-center p-1 bg-green-50 dark:bg-green-950/20 rounded text-sm">
                        <span>{inv.nome}</span>
                        <span className="font-semibold text-green-600">{formatCurrency(inv.valor)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;