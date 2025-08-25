import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  TrendingUp, 
  Users,
  DollarSign,
  Target,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowRight,
  Eye,
  Activity,
  PieChart,
  Building,
  BarChart3,
  Zap
} from 'lucide-react';
import { format, addMonths, startOfMonth, endOfMonth, parseISO, differenceInMonths, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface EmprestimoCompleto {
  id: string;
  devedor: string;
  valor_total: number;
  data_emprestimo: string;
  taxa_mensal: number;
  taxa_intermediador: number;
  tipo_pagamento: string;
  status: string;
  emprestimo_parceiros: any[];
}

interface RecebimentoRealizado {
  emprestimo_id: string;
  data_vencimento: string;
  valor_recebido: number;
  valor_esperado: number;
  seu_valor: number;
  parceiro_valor: number;
  status: string;
}

interface DashboardStats {
  totalEmprestado: number;
  rendimentoTotalRealizado: number;
  rendimentoIntermediadorRealizado: number;
  rendimentoInvestidoresRealizado: number;
  mediaRendimentoMensal: number;
  projecaoProximos6Meses: number;
  projecaoIntermediador6Meses: number;
  projecaoInvestidores6Meses: number;
  emprestimosAtivos: number;
  totalInvestidores: number;
  totalDevedores: number;
  totalAtrasado: number;
  quantidadeAtrasados: number;
  valorAtrasadoIntermediador: number;
  valorAtrasadoInvestidores: number;
  roiMedio: number;
  taxaMediaPonderada: number;
  tempoMedioInvestimento: number;
}

interface InvestidorDetalhado {
  nome: string;
  totalInvestido: number;
  rendimentoRealizado: number;
  emprestimosAtivos: number;
  taxaEfetiva: number;
  participacaoTotal: number;
  roiRealizado: number;
  projecao6Meses: number;
  valorAtrasado: number;
}

interface DevedorDetalhado {
  devedor: string;
  totalEmprestado: number;
  rendimentoPago: number;
  emprestimosAtivos: number;
  taxaMedia: number;
  status: 'em_dia' | 'atrasado';
  parcelasAtrasadas: number;
  valorAtrasado: number;
  historicoPagamentos: number;
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
  const [emprestimos, setEmprestimos] = useState<EmprestimoCompleto[]>([]);
  const [pagamentosRecebidos, setPagamentosRecebidos] = useState<RecebimentoRealizado[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
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
      default:
        data.setMonth(data.getMonth() + numeroMes);
        break;
    }
    
    return data;
  };

  const calcularStatusDevedor = (emprestimo: EmprestimoCompleto): { status: 'em_dia' | 'atrasado'; parcelasAtrasadas: number } => {
    const dataEmprestimo = parseISO(emprestimo.data_emprestimo);
    const tipoPagamento = emprestimo.tipo_pagamento || 'mensal';
    const hoje = new Date();
    let parcelasAtrasadas = 0;
    
    let numeroMes = 1;
    let proximoPagamento = calcularProximoPagamento(dataEmprestimo, tipoPagamento, numeroMes);
    
    while (proximoPagamento < hoje && numeroMes < 120) {
      const pagamentoEncontrado = pagamentosRecebidos.find(p => 
        p.emprestimo_id === emprestimo.id &&
        new Date(p.data_vencimento).getMonth() === proximoPagamento.getMonth() &&
        new Date(p.data_vencimento).getFullYear() === proximoPagamento.getFullYear() &&
        p.status === 'pago'
      );

      if (!pagamentoEncontrado) {
        parcelasAtrasadas++;
      }

      numeroMes++;
      proximoPagamento = calcularProximoPagamento(dataEmprestimo, tipoPagamento, numeroMes);
    }

    return {
      status: parcelasAtrasadas > 0 ? 'atrasado' : 'em_dia',
      parcelasAtrasadas
    };
  };

  const calcularProjecao6Meses = (): ProjecaoMensal[] => {
    const hoje = new Date();
    const projecoes: ProjecaoMensal[] = [];
    
    for (let i = 0; i < 6; i++) {
      const mesProjecao = addMonths(hoje, i);
      const inicioMes = startOfMonth(mesProjecao);
      const fimMes = endOfMonth(mesProjecao);
      
      let totalPrevisto = 0;
      let intermediadorTotal = 0;
      const investidoresMap = new Map<string, number>();
      
      emprestimos.forEach(emprestimo => {
        if (emprestimo.status !== 'ativo') return;
        
        const dataEmprestimo = parseISO(emprestimo.data_emprestimo);
        const tipoPagamento = emprestimo.tipo_pagamento || 'mensal';
        
        let numeroMes = 1;
        let proximoPagamento = calcularProximoPagamento(dataEmprestimo, tipoPagamento, numeroMes);
        
        while (proximoPagamento <= fimMes && numeroMes < 120) {
          if (proximoPagamento >= inicioMes && proximoPagamento <= fimMes) {
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
            
            if (emprestimo.emprestimo_parceiros && emprestimo.emprestimo_parceiros.length > 0) {
              emprestimo.emprestimo_parceiros.forEach((parceiro: any) => {
                const valorParceiro = (rendimentoInvestidores * parceiro.percentual_participacao) / 100;
                const nomeAtual = investidoresMap.get(parceiro.nome_parceiro) || 0;
                investidoresMap.set(parceiro.nome_parceiro, nomeAtual + valorParceiro);
              });
            } else {
              const nomeAtual = investidoresMap.get("Investidores") || 0;
              investidoresMap.set("Investidores", nomeAtual + rendimentoInvestidores);
            }
          }
          
          numeroMes++;
          proximoPagamento = calcularProximoPagamento(dataEmprestimo, tipoPagamento, numeroMes);
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

  const calcularRendimentosRealizados = () => {
    let rendimentoIntermediadorRealizado = 0;
    let rendimentoInvestidoresRealizado = 0;
    let totalEmprestado = 0;
    let totalPago = 0;

    emprestimos.forEach(emprestimo => {
      if (emprestimo.status === 'ativo') {
        totalEmprestado += emprestimo.valor_total;
      }
    });

    pagamentosRecebidos.forEach(pagamento => {
      if (pagamento.status === 'pago') {
        totalPago += pagamento.valor_recebido;
        rendimentoIntermediadorRealizado += parseFloat(pagamento.seu_valor?.toString() || '0');
        rendimentoInvestidoresRealizado += parseFloat(pagamento.parceiro_valor?.toString() || '0');
      }
    });

    const rendimentoTotalRealizado = rendimentoIntermediadorRealizado + rendimentoInvestidoresRealizado;
    const roiMedio = totalEmprestado > 0 ? (rendimentoTotalRealizado / totalEmprestado) * 100 : 0;

    return {
      totalEmprestado,
      rendimentoTotalRealizado,
      rendimentoIntermediadorRealizado,
      rendimentoInvestidoresRealizado,
      roiMedio,
      totalRecebido: totalPago
    };
  };

  const dashboardStats: DashboardStats = useMemo(() => {
    const activeLoans = emprestimos.filter(loan => loan.status === 'ativo');
    const rendimentos = calcularRendimentosRealizados();
    const projecoes = calcularProjecao6Meses();
    
    let totalAtrasado = 0;
    let quantidadeAtrasados = 0;
    let valorAtrasadoIntermediador = 0;
    let valorAtrasadoInvestidores = 0;

    activeLoans.forEach(emprestimo => {
      const statusDevedor = calcularStatusDevedor(emprestimo);
      if (statusDevedor.status === 'atrasado') {
        quantidadeAtrasados++;
        const rendimentoMensal = emprestimo.valor_total * (emprestimo.taxa_mensal / 100);
        const valorAtrasadoEmprestimo = rendimentoMensal * statusDevedor.parcelasAtrasadas;
        totalAtrasado += valorAtrasadoEmprestimo;
        
        const rendimentoIntermediador = emprestimo.valor_total * (emprestimo.taxa_intermediador / 100);
        valorAtrasadoIntermediador += rendimentoIntermediador * statusDevedor.parcelasAtrasadas;
        
        const rendimentoInvestidores = rendimentoMensal - rendimentoIntermediador;
        valorAtrasadoInvestidores += rendimentoInvestidores * statusDevedor.parcelasAtrasadas;
      }
    });

    const investidoresUnicos = new Set<string>();
    activeLoans.forEach(loan => {
      if (loan.emprestimo_parceiros && loan.emprestimo_parceiros.length > 0) {
        loan.emprestimo_parceiros.forEach((p: any) => {
          investidoresUnicos.add(p.nome_parceiro);
        });
      }
    });

    const devedoresUnicos = new Set(activeLoans.map(loan => loan.devedor));

    return {
      totalEmprestado: rendimentos.totalEmprestado,
      rendimentoTotalRealizado: rendimentos.rendimentoTotalRealizado,
      rendimentoIntermediadorRealizado: rendimentos.rendimentoIntermediadorRealizado,
      rendimentoInvestidoresRealizado: rendimentos.rendimentoInvestidoresRealizado,
      mediaRendimentoMensal: rendimentos.rendimentoTotalRealizado / Math.max(1, activeLoans.length),
      projecaoProximos6Meses: projecoes.reduce((sum, p) => sum + p.totalPrevisto, 0),
      projecaoIntermediador6Meses: projecoes.reduce((sum, p) => sum + p.intermediador, 0),
      projecaoInvestidores6Meses: projecoes.reduce((sum, p) => sum + p.investidores.reduce((s, i) => s + i.valor, 0), 0),
      emprestimosAtivos: activeLoans.length,
      totalInvestidores: investidoresUnicos.size,
      totalDevedores: devedoresUnicos.size,
      totalAtrasado,
      quantidadeAtrasados,
      valorAtrasadoIntermediador,
      valorAtrasadoInvestidores,
      roiMedio: rendimentos.roiMedio,
      taxaMediaPonderada: rendimentos.totalEmprestado > 0 ? (rendimentos.rendimentoTotalRealizado / rendimentos.totalEmprestado) * 100 : 0,
      tempoMedioInvestimento: activeLoans.length > 0 ? activeLoans.reduce((sum, loan) => sum + differenceInMonths(new Date(), parseISO(loan.data_emprestimo)), 0) / activeLoans.length : 0
    };
  }, [emprestimos, pagamentosRecebidos]);

  const investidoresDetalhados: InvestidorDetalhado[] = useMemo(() => {
    const investidoresMap = new Map<string, InvestidorDetalhado>();

    pagamentosRecebidos.forEach(pagamento => {
      if (pagamento.status === 'pago') {
        const emprestimo = emprestimos.find(e => e.id === pagamento.emprestimo_id);
        if (emprestimo && emprestimo.emprestimo_parceiros?.length > 0) {
          const valorTotalInvestidores = parseFloat(pagamento.parceiro_valor?.toString() || '0');
          
          emprestimo.emprestimo_parceiros.forEach((inv: any) => {
            const valorInvestidor = (valorTotalInvestidores * inv.percentual_participacao) / 100;
            const nome = inv.nome_parceiro;
            
            if (!investidoresMap.has(nome)) {
              investidoresMap.set(nome, {
                nome,
                totalInvestido: 0,
                rendimentoRealizado: 0,
                emprestimosAtivos: 0,
                taxaEfetiva: 0,
                participacaoTotal: 0,
                roiRealizado: 0,
                projecao6Meses: 0,
                valorAtrasado: 0
              });
            }
            
            const investidor = investidoresMap.get(nome)!;
            investidor.rendimentoRealizado += valorInvestidor;
          });
        }
      }
    });

    const projecoes = calcularProjecao6Meses();
    investidoresMap.forEach((investidor, nome) => {
      emprestimos.forEach(emprestimo => {
        if (emprestimo.status === 'ativo' && emprestimo.emprestimo_parceiros?.length > 0) {
          const parceiro = emprestimo.emprestimo_parceiros.find((p: any) => p.nome_parceiro === nome);
          if (parceiro) {
            const valorInvestido = (emprestimo.valor_total * parceiro.percentual_participacao) / 100;
            investidor.totalInvestido += valorInvestido;
            investidor.emprestimosAtivos++;
          }
        }
      });

      investidor.roiRealizado = investidor.totalInvestido > 0 ? (investidor.rendimentoRealizado / investidor.totalInvestido) * 100 : 0;
      investidor.participacaoTotal = (investidor.totalInvestido / dashboardStats.totalEmprestado) * 100;
      investidor.taxaEfetiva = investidor.roiRealizado;

      projecoes.forEach(projecao => {
        const investidorProjecao = projecao.investidores.find(i => i.nome === nome);
        if (investidorProjecao) {
          investidor.projecao6Meses += investidorProjecao.valor;
        }
      });
    });

    return Array.from(investidoresMap.values()).sort((a, b) => b.rendimentoRealizado - a.rendimentoRealizado);
  }, [emprestimos, pagamentosRecebidos, dashboardStats.totalEmprestado]);

  const devedoresDetalhados: DevedorDetalhado[] = useMemo(() => {
    const devedoresMap = new Map<string, DevedorDetalhado>();

    emprestimos.forEach(emprestimo => {
      if (emprestimo.status === 'ativo') {
        const nome = emprestimo.devedor;
        const statusDevedor = calcularStatusDevedor(emprestimo);
        
        const rendimentoPago = pagamentosRecebidos
          .filter(p => p.emprestimo_id === emprestimo.id && p.status === 'pago')
          .reduce((sum, p) => sum + p.valor_recebido, 0);

        if (!devedoresMap.has(nome)) {
          devedoresMap.set(nome, {
            devedor: nome,
            totalEmprestado: 0,
            rendimentoPago: 0,
            emprestimosAtivos: 0,
            taxaMedia: 0,
            status: 'em_dia',
            parcelasAtrasadas: 0,
            valorAtrasado: 0,
            historicoPagamentos: 100
          });
        }

        const devedor = devedoresMap.get(nome)!;
        devedor.totalEmprestado += emprestimo.valor_total;
        devedor.rendimentoPago += rendimentoPago;
        devedor.emprestimosAtivos++;
        
        if (statusDevedor.status === 'atrasado') {
          devedor.status = 'atrasado';
          devedor.parcelasAtrasadas += statusDevedor.parcelasAtrasadas;
          
          const rendimentoMensal = emprestimo.valor_total * (emprestimo.taxa_mensal / 100);
          devedor.valorAtrasado += rendimentoMensal * statusDevedor.parcelasAtrasadas;
        }
      }
    });

    devedoresMap.forEach(devedor => {
      devedor.taxaMedia = devedor.totalEmprestado > 0 ? (devedor.rendimentoPago / devedor.totalEmprestado) * 100 : 0;
      devedor.historicoPagamentos = devedor.status === 'em_dia' ? 100 : Math.max(0, 100 - (devedor.parcelasAtrasadas * 10));
    });

    return Array.from(devedoresMap.values()).sort((a, b) => b.rendimentoPago - a.rendimentoPago);
  }, [emprestimos, pagamentosRecebidos]);

  const projecoesMensais = useMemo(() => {
    return calcularProjecao6Meses();
  }, [emprestimos]);

  const navegarParaAnaliseDetalhada = (tipo: 'investidor' | 'devedor', filtro?: string) => {
    if (tipo === 'investidor') {
      navigate('/investidores', { state: { filtroNome: filtro } });
    } else {
      navigate('/emprestimos', { state: { filtroDevedor: filtro } });
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);

      const { data: loansData, error: loansError } = await supabase
        .from('emprestimos')
        .select(`
          *,
          emprestimo_parceiros:emprestimo_parceiros(*)
        `);

      if (loansError) throw loansError;

      const { data: paymentsData, error: paymentsError } = await supabase
        .from('recebimentos')
        .select('*')
        .order('data_vencimento', { ascending: true });

      if (paymentsError) throw paymentsError;

      setEmprestimos(loansData || []);
      setPagamentosRecebidos(paymentsData || []);

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
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral inteligente dos seus investimentos</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Emprestado</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(dashboardStats.totalEmprestado)}
            </div>
            <p className="text-xs text-muted-foreground">
              {dashboardStats.emprestimosAtivos} empréstimos ativos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rendimento Realizado</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(dashboardStats.rendimentoTotalRealizado)}
            </div>
            <p className="text-xs text-muted-foreground">
              ROI: {formatPercent(dashboardStats.roiMedio)}
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
              {formatCurrency(dashboardStats.rendimentoIntermediadorRealizado)}
            </div>
            <p className="text-xs text-muted-foreground">
              Valores recebidos
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
              {formatCurrency(dashboardStats.rendimentoInvestidoresRealizado)}
            </div>
            <p className="text-xs text-muted-foreground">
              {dashboardStats.totalInvestidores} investidores ativos
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <h2 className="text-xl font-semibold mb-4">Projeção 6 Meses</h2>
          <div className="space-y-4">
            <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Total Previsto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-blue-600">
                  {formatCurrency(dashboardStats.projecaoProximos6Meses)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Média: {formatCurrency(dashboardStats.projecaoProximos6Meses / 6)}/mês
                </p>
              </CardContent>
            </Card>

            <Card className="bg-purple-50 dark:bg-purple-950/20 border-purple-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Projeção Intermediador</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-purple-600">
                  {formatCurrency(dashboardStats.projecaoIntermediador6Meses)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Média: {formatCurrency(dashboardStats.projecaoIntermediador6Meses / 6)}/mês
                </p>
              </CardContent>
            </Card>

            <Card className="bg-orange-50 dark:bg-orange-950/20 border-orange-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Projeção Investidores</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-orange-600">
                  {formatCurrency(dashboardStats.projecaoInvestidores6Meses)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Média: {formatCurrency(dashboardStats.projecaoInvestidores6Meses / 6)}/mês
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Calendário de Recebimentos - Próximos 6 Meses
              </CardTitle>
              <CardDescription>
                Projeções detalhadas mês a mês por investidor
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projecoesMensais.map((projecao, index) => (
                  <div key={index} className="p-4 border rounded-lg bg-muted/30">
                    <h3 className="font-semibold text-lg mb-2">
                      {format(projecao.mes, 'MMMM yyyy', { locale: ptBR })}
                    </h3>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Total Previsto:</span>
                        <span className="font-bold text-blue-600">
                          {formatCurrency(projecao.totalPrevisto)}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Intermediador:</span>
                        <span className="font-bold text-purple-600">
                          {formatCurrency(projecao.intermediador)}
                        </span>
                      </div>
                      
                      <div className="mt-3">
                        <span className="text-sm text-muted-foreground font-medium">Investidores:</span>
                        {projecao.investidores.map((inv, invIndex) => (
                          <div key={invIndex} className="flex justify-between items-center ml-2">
                            <span className="text-xs text-muted-foreground">{inv.nome}</span>
                            <span className="text-sm font-medium text-green-600">
                              {formatCurrency(inv.valor)}
                            </span>
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
      </div>

      {(dashboardStats.totalAtrasado > 0 || dashboardStats.quantidadeAtrasados > 0) && (
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
                <div className="text-2xl font-bold text-red-600">{dashboardStats.quantidadeAtrasados}</div>
                <div className="text-sm text-red-700">Empréstimos atrasados</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{formatCurrency(dashboardStats.totalAtrasado)}</div>
                <div className="text-sm text-red-700">Valor total atrasado</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{formatCurrency(dashboardStats.valorAtrasadoIntermediador)}</div>
                <div className="text-sm text-red-700">Intermediador atrasado</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{formatCurrency(dashboardStats.valorAtrasadoInvestidores)}</div>
                <div className="text-sm text-red-700">Investidores atrasado</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Análise Detalhada por Investidor</CardTitle>
            <CardDescription>
              Performance completa de cada parceiro - apenas valores efetivamente recebidos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {investidoresDetalhados.map((investidor, index) => (
                <div
                  key={investidor.nome}
                  className="border rounded-lg p-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navegarParaAnaliseDetalhada('investidor', investidor.nome)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="font-bold text-lg">{investidor.nome}</div>
                      <Badge variant="outline">{formatPercent(investidor.participacaoTotal)}</Badge>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-600">
                        {formatCurrency(investidor.rendimentoRealizado)}
                      </div>
                      <div className="text-sm text-muted-foreground">Realizado</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-sm">
                    <div className="text-center bg-white dark:bg-gray-800 rounded p-2">
                      <div className="font-semibold">{formatCurrency(investidor.totalInvestido)}</div>
                      <div className="text-muted-foreground">Capital</div>
                    </div>
                    <div className="text-center bg-white dark:bg-gray-800 rounded p-2">
                      <div className="font-semibold text-green-600">{formatCurrency(investidor.rendimentoRealizado)}</div>
                      <div className="text-muted-foreground">Recebido</div>
                    </div>
                    <div className="text-center bg-white dark:bg-gray-800 rounded p-2">
                      <div className="font-semibold text-blue-600">{formatPercent(investidor.taxaEfetiva)}</div>
                      <div className="text-muted-foreground">ROI Real</div>
                    </div>
                    <div className="text-center bg-white dark:bg-gray-800 rounded p-2">
                      <div className="font-semibold text-purple-600">{formatPercent(investidor.roiRealizado)}</div>
                      <div className="text-muted-foreground">ROI Total</div>
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
                  
                  <div className="mt-2 flex justify-end">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Análise Detalhada por Devedor</CardTitle>
            <CardDescription>
              Performance e status de cada cliente - apenas valores efetivamente recebidos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {devedoresDetalhados.map((devedor, index) => (
                <div
                  key={devedor.devedor}
                  className={`border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow ${
                    devedor.status === 'atrasado' 
                      ? 'bg-red-50 dark:bg-red-950/20 border-red-200' 
                      : 'bg-gray-50 dark:bg-gray-950/20'
                  }`}
                  onClick={() => navegarParaAnaliseDetalhada('devedor', devedor.devedor)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="font-bold text-lg">{devedor.devedor}</div>
                      <Badge variant={devedor.status === 'atrasado' ? 'destructive' : 'default'}>
                        {devedor.status === 'em_dia' 
                          ? 'Em dia' 
                          : `${devedor.parcelasAtrasadas} Atrasada(s)`}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-blue-600">
                        {formatCurrency(devedor.rendimentoPago)}
                      </div>
                      <div className="text-sm text-muted-foreground">Pago</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-sm">
                    <div className="text-center bg-white dark:bg-gray-800 rounded p-2">
                      <div className="font-semibold">{formatCurrency(devedor.totalEmprestado)}</div>
                      <div className="text-muted-foreground">Emprestado</div>
                    </div>
                    <div className="text-center bg-white dark:bg-gray-800 rounded p-2">
                      <div className="font-semibold text-green-600">{formatCurrency(devedor.rendimentoPago)}</div>
                      <div className="text-muted-foreground">Recebido</div>
                    </div>
                    <div className="text-center bg-white dark:bg-gray-800 rounded p-2">
                      <div className="font-semibold text-blue-600">{formatPercent(devedor.taxaMedia)}</div>
                      <div className="text-muted-foreground">ROI Real</div>
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
                          <span className="text-red-600">Parcelas atrasadas:</span>
                          <span className="font-semibold text-red-600">{devedor.parcelasAtrasadas}</span>
                        </div>
                      </>
                    )}
                  </div>
                  
                  <div className="mt-2 flex justify-end">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa Média Ponderada</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatPercent(dashboardStats.taxaMediaPonderada)}
            </div>
            <p className="text-xs text-muted-foreground">
              Baseado em valores realizados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">
              {dashboardStats.tempoMedioInvestimento.toFixed(1)} meses
            </div>
            <p className="text-xs text-muted-foreground">
              Duração média dos empréstimos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rendimento Médio</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(dashboardStats.mediaRendimentoMensal)}
            </div>
            <p className="text-xs text-muted-foreground">
              Por empréstimo ativo
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            Resumo Geral
          </CardTitle>
          <CardDescription>
            Visão consolidada da carteira de investimentos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
              <Building className="h-8 w-8 mx-auto mb-2 text-blue-600" />
              <div className="text-2xl font-bold text-blue-600">{dashboardStats.totalDevedores}</div>
              <div className="text-sm text-muted-foreground">Devedores Ativos</div>
            </div>
            
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <Users className="h-8 w-8 mx-auto mb-2 text-green-600" />
              <div className="text-2xl font-bold text-green-600">{dashboardStats.totalInvestidores}</div>
              <div className="text-sm text-muted-foreground">Investidores Ativos</div>
            </div>
            
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
              <DollarSign className="h-8 w-8 mx-auto mb-2 text-purple-600" />
              <div className="text-2xl font-bold text-purple-600">{dashboardStats.emprestimosAtivos}</div>
              <div className="text-sm text-muted-foreground">Empréstimos Ativos</div>
            </div>
            
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 text-orange-600" />
              <div className="text-2xl font-bold text-orange-600">
                {formatPercent(dashboardStats.roiMedio)}
              </div>
              <div className="text-sm text-muted-foreground">ROI Médio Realizado</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;