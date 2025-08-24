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
  Building
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DashboardStats {
  totalEmprestado: number;
  rendimentoMensalTotal: number;
  rendimentoIntermediador: number;
  rendimentoInvestidores: number;
  proximosRecebimentos: number;
  emprestimosAtivos: number;
  totalInvestidores: number;
  totalDevedores: number;
}

interface InvestidorStats {
  nome: string;
  totalInvestido: number;
  rendimentoMensal: number;
  emprestimosAtivos: number;
  taxaEfetiva: number;
  participacaoTotal: number;
}

interface DevedorStats {
  devedor: string;
  totalEmprestado: number;
  rendimentoMensal: number;
  emprestimosAtivos: number;
  taxaMedia: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalEmprestado: 0,
    rendimentoMensalTotal: 0,
    rendimentoIntermediador: 0,
    rendimentoInvestidores: 0,
    proximosRecebimentos: 0,
    emprestimosAtivos: 0,
    totalInvestidores: 0,
    totalDevedores: 0,
  });
  
  const [investidoresStats, setInvestidoresStats] = useState<InvestidorStats[]>([]);
  const [devedoresStats, setDevedoresStats] = useState<DevedorStats[]>([]);
  const [recentLoans, setRecentLoans] = useState<Emprestimo[]>([]);
  const [upcomingPayments, setUpcomingPayments] = useState<any[]>([]);
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

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load loans with partners data
      const { data: loans, error: loansError } = await supabase
        .from('emprestimos')
        .select(`
          *,
          emprestimo_parceiros:emprestimo_parceiros(*)
        `)
        .order('created_at', { ascending: false });

      if (loansError) throw loansError;

      // Load payments data
      const { data: payments, error: paymentsError } = await supabase
        .from('recebimentos')
        .select(`
          *,
          emprestimo:emprestimos!inner(devedor)
        `)
        .order('data_vencimento', { ascending: true })
        .limit(10);

      if (paymentsError) throw paymentsError;

      // Calculate main stats
      const activeLoans = loans?.filter(loan => loan.status === 'ativo') || [];
      const totalEmprestado = activeLoans.reduce((sum, loan) => sum + (loan.valor_total || 0), 0);
      const rendimentoMensalTotal = activeLoans.reduce((sum, loan) => sum + (loan.rendimento_total || loan.rendimento_mensal || 0), 0);
      
      // Calculate intermediador and investors income
      const rendimentoIntermediador = activeLoans.reduce((sum, loan) => {
        return sum + (loan.rendimento_intermediador || 0);
      }, 0);
      
      const rendimentoInvestidores = rendimentoMensalTotal - rendimentoIntermediador;
      
      // Calculate upcoming payments (next 30 days)
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      
      const proximosRecebimentos = payments?.filter(payment => {
        const paymentDate = new Date(payment.data_vencimento);
        return paymentDate <= thirtyDaysFromNow && payment.status === 'pendente';
      }).reduce((sum, payment) => sum + (payment.valor_esperado || 0), 0) || 0;

      // Calculate investors stats
      const investidoresMap = new Map<string, InvestidorStats>();
      
      activeLoans.forEach(loan => {
        if (loan.emprestimo_parceiros && loan.emprestimo_parceiros.length > 0) {
          loan.emprestimo_parceiros.forEach((parceiro: any) => {
            const nome = parceiro.nome_parceiro;
            const valorInvestido = parceiro.valor_investido;
            const taxaInvestidores = (loan.taxa_total || loan.taxa_mensal) - (loan.taxa_intermediador || 0);
            const rendimentoMensal = (valorInvestido * taxaInvestidores) / 100;
            
            if (!investidoresMap.has(nome)) {
              investidoresMap.set(nome, {
                nome,
                totalInvestido: 0,
                rendimentoMensal: 0,
                emprestimosAtivos: 0,
                taxaEfetiva: 0,
                participacaoTotal: 0
              });
            }
            
            const investidor = investidoresMap.get(nome)!;
            investidor.totalInvestido += valorInvestido;
            investidor.rendimentoMensal += rendimentoMensal;
            investidor.emprestimosAtivos += 1;
            investidor.participacaoTotal = (investidor.totalInvestido / totalEmprestado) * 100;
            investidor.taxaEfetiva = (investidor.rendimentoMensal / investidor.totalInvestido) * 100;
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
                emprestimosAtivos: 0,
                taxaEfetiva: 0,
                participacaoTotal: 0
              });
            }
            const investidor = investidoresMap.get(nome)!;
            investidor.totalInvestido += loan.valor_seu;
            investidor.rendimentoMensal += loan.seu_rendimento || 0;
            investidor.emprestimosAtivos += 1;
          }
          
          if (loan.valor_parceiro && loan.valor_parceiro > 0) {
            const nome = "Parceiro";
            if (!investidoresMap.has(nome)) {
              investidoresMap.set(nome, {
                nome,
                totalInvestido: 0,
                rendimentoMensal: 0,
                emprestimosAtivos: 0,
                taxaEfetiva: 0,
                participacaoTotal: 0
              });
            }
            const investidor = investidoresMap.get(nome)!;
            investidor.totalInvestido += loan.valor_parceiro;
            investidor.rendimentoMensal += loan.parceiro_rendimento || 0;
            investidor.emprestimosAtivos += 1;
          }
        }
      });

      // Update participation percentages
      investidoresMap.forEach((investidor) => {
        investidor.participacaoTotal = (investidor.totalInvestido / totalEmprestado) * 100;
        investidor.taxaEfetiva = investidor.totalInvestido > 0 ? (investidor.rendimentoMensal / investidor.totalInvestido) * 100 : 0;
      });

      // Calculate debtors stats
      const devedoresMap = new Map<string, DevedorStats>();
      
      activeLoans.forEach(loan => {
        const devedor = loan.devedor;
        
        if (!devedoresMap.has(devedor)) {
          devedoresMap.set(devedor, {
            devedor,
            totalEmprestado: 0,
            rendimentoMensal: 0,
            emprestimosAtivos: 0,
            taxaMedia: 0
          });
        }
        
        const devedorData = devedoresMap.get(devedor)!;
        devedorData.totalEmprestado += loan.valor_total;
        devedorData.rendimentoMensal += (loan.rendimento_total || loan.rendimento_mensal || 0);
        devedorData.emprestimosAtivos += 1;
        devedorData.taxaMedia = (devedorData.rendimentoMensal / devedorData.totalEmprestado) * 100;
      });

      // Count unique entities
      const totalInvestidores = investidoresMap.size;
      const totalDevedores = devedoresMap.size;
      const emprestimosAtivos = activeLoans.length;

      setStats({
        totalEmprestado,
        rendimentoMensalTotal,
        rendimentoIntermediador,
        rendimentoInvestidores,
        proximosRecebimentos,
        emprestimosAtivos,
        totalInvestidores,
        totalDevedores,
      });

      setInvestidoresStats(Array.from(investidoresMap.values()).sort((a, b) => b.rendimentoMensal - a.rendimentoMensal));
      setDevedoresStats(Array.from(devedoresMap.values()).sort((a, b) => b.rendimentoMensal - a.rendimentoMensal));
      setRecentLoans(loans?.slice(0, 5) || []);
      setUpcomingPayments(payments || []);

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

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
            <CardTitle className="text-sm font-medium">Rendimento Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {formatCurrency(stats.rendimentoMensalTotal)}
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              <ArrowUp className="h-3 w-3 mr-1" />
              {stats.totalEmprestado > 0 ? formatPercent((stats.rendimentoMensalTotal / stats.totalEmprestado) * 100) : '0%'} efetivo
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sua Comissão</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {formatCurrency(stats.rendimentoIntermediador)}
            </div>
            <p className="text-xs text-muted-foreground">
              Intermediação mensal
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
              {formatCurrency(stats.rendimentoInvestidores)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.totalInvestidores} investidores ativos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Próximos Recebimentos</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              {formatCurrency(stats.proximosRecebimentos)}
            </div>
            <p className="text-xs text-muted-foreground">
              Próximos 30 dias
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Devedores</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalDevedores}
            </div>
            <p className="text-xs text-muted-foreground">
              Clientes únicos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.emprestimosAtivos > 0 ? formatCurrency(stats.totalEmprestado / stats.emprestimosAtivos) : formatCurrency(0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Por empréstimo
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance por Investidor */}
        <Card>
          <CardHeader>
            <CardTitle>Performance por Investidor</CardTitle>
            <CardDescription>
              Análise detalhada de cada parceiro investidor
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {investidoresStats.map((investidor, index) => (
                <div key={investidor.nome} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{investidor.nome}</div>
                      <Badge variant="outline">{formatPercent(investidor.participacaoTotal)}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatCurrency(investidor.totalInvestido)} • {investidor.emprestimosAtivos} empréstimos
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-success">
                      {formatCurrency(investidor.rendimentoMensal)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatPercent(investidor.taxaEfetiva)} a.m.
                    </div>
                  </div>
                </div>
              ))}
              {investidoresStats.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  Nenhum investidor encontrado
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Performance por Devedor */}
        <Card>
          <CardHeader>
            <CardTitle>Performance por Devedor</CardTitle>
            <CardDescription>
              Análise de rendimento por cliente devedor
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {devedoresStats.map((devedor, index) => (
                <div key={devedor.devedor} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{devedor.devedor}</div>
                      <Badge variant="secondary">{devedor.emprestimosAtivos} ativos</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatCurrency(devedor.totalEmprestado)} emprestados
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-primary">
                      {formatCurrency(devedor.rendimentoMensal)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatPercent(devedor.taxaMedia)} a.m.
                    </div>
                  </div>
                </div>
              ))}
              {devedoresStats.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  Nenhum devedor encontrado
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Loans and Upcoming Payments - Existing sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Empréstimos Recentes</CardTitle>
            <CardDescription>
              Os 5 empréstimos mais recentes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentLoans.map((loan) => (
                <div 
                  key={loan.id} 
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                >
                  <div>
                    <div className="font-medium">{loan.devedor}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatCurrency(loan.valor_total)}
                    </div>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={loan.status} />
                    <div className="text-sm text-muted-foreground">
                      {loan.taxa_mensal}% a.m.
                    </div>
                  </div>
                </div>
              ))}
              {recentLoans.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  Nenhum empréstimo encontrado
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Próximos Vencimentos</CardTitle>
            <CardDescription>
              Pagamentos esperados nos próximos dias
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingPayments.slice(0, 5).map((payment) => (
                <div 
                  key={payment.id} 
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                >
                  <div>
                    <div className="font-medium">
                      {payment.emprestimo?.devedor || 'N/A'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Vence em {format(new Date(payment.data_vencimento), 'dd/MM/yyyy', { locale: ptBR })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">
                      {formatCurrency(payment.valor_esperado)}
                    </div>
                    <StatusBadge status={payment.status} />
                  </div>
                </div>
              ))}
              {upcomingPayments.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  Nenhum pagamento pendente
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;