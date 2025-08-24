import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  BarChart3, 
  TrendingUp, 
  PieChart,
  Calendar,
  Loader2 
} from 'lucide-react';

const Reports = () => {
  const [loading, setLoading] = useState(true);
  const [monthlyStats, setMonthlyStats] = useState<any>({});
  const [debtorStats, setDebtorStats] = useState<any[]>([]);
  const { toast } = useToast();

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const loadReportsData = async () => {
    try {
      setLoading(true);

      // Load monthly statistics
      const { data: loans, error: loansError } = await supabase
        .from('emprestimos')
        .select('*');

      if (loansError) throw loansError;

      const { data: payments, error: paymentsError } = await supabase
        .from('recebimentos')
        .select('*');

      if (paymentsError) throw paymentsError;

      // Calculate current month stats
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      
      const currentMonthPayments = payments?.filter(payment => {
        const paymentDate = new Date(payment.data_vencimento);
        return paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear;
      }) || [];

      const totalAReceber = currentMonthPayments.reduce((sum, payment) => 
        sum + (payment.status === 'pendente' ? payment.valor_esperado : 0), 0
      );
      
      const jaRecebido = currentMonthPayments.reduce((sum, payment) => 
        sum + (payment.status === 'pago' ? (payment.valor_recebido || payment.valor_esperado) : 0), 0
      );

      const suaParte = currentMonthPayments.reduce((sum, payment) => 
        sum + (payment.status === 'pago' ? payment.seu_valor : 0), 0
      );

      const parteParceio = currentMonthPayments.reduce((sum, payment) => 
        sum + (payment.status === 'pago' ? payment.parceiro_valor : 0), 0
      );

      setMonthlyStats({
        totalAReceber,
        jaRecebido,
        suaParte,
        parteParceio,
        totalPrevisto: totalAReceber + jaRecebido
      });

      // Calculate stats by debtor
      const debtorMap = new Map();
      
      loans?.forEach(loan => {
        if (!debtorMap.has(loan.devedor)) {
          debtorMap.set(loan.devedor, {
            devedor: loan.devedor,
            totalEmprestado: 0,
            rendimentoMensal: 0,
            emprestimosAtivos: 0,
            status: []
          });
        }
        
        const debtor = debtorMap.get(loan.devedor);
        debtor.totalEmprestado += loan.valor_total;
        debtor.rendimentoMensal += (loan.rendimento_mensal || 0);
        
        if (loan.status === 'ativo') {
          debtor.emprestimosAtivos += 1;
        }
        
        if (!debtor.status.includes(loan.status)) {
          debtor.status.push(loan.status);
        }
      });

      setDebtorStats(Array.from(debtorMap.values()));

    } catch (error: any) {
      toast({
        title: "Erro ao carregar relatórios",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportsData();
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
        <h1 className="text-3xl font-bold text-foreground">Relatórios</h1>
        <p className="text-muted-foreground">Análise financeira dos seus investimentos</p>
      </div>

      {/* Monthly Report */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Resumo do Mês Atual
          </CardTitle>
          <CardDescription>
            Relatório financeiro de {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(monthlyStats.totalPrevisto || 0)}
              </div>
              <div className="text-sm text-muted-foreground">Total Previsto</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-success">
                {formatCurrency(monthlyStats.jaRecebido || 0)}
              </div>
              <div className="text-sm text-muted-foreground">Já Recebido</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-warning">
                {formatCurrency(monthlyStats.totalAReceber || 0)}
              </div>
              <div className="text-sm text-muted-foreground">A Receber</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-2">Distribuição</div>
              <div className="space-y-1">
                <div className="text-sm">
                  <span className="text-success font-medium">Você:</span> {formatCurrency(monthlyStats.suaParte || 0)}
                </div>
                <div className="text-sm">
                  <span className="text-primary font-medium">Parceiro:</span> {formatCurrency(monthlyStats.parteParceio || 0)}
                </div>
              </div>
            </div>
          </div>
          
          {monthlyStats.totalPrevisto > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between text-sm mb-2">
                <span>Progresso do Mês</span>
                <span>{((monthlyStats.jaRecebido / monthlyStats.totalPrevisto) * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-success h-2 rounded-full transition-all" 
                  style={{ width: `${Math.min((monthlyStats.jaRecebido / monthlyStats.totalPrevisto) * 100, 100)}%` }}
                ></div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance by Debtor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Performance por Devedor
          </CardTitle>
          <CardDescription>
            Análise de rendimento por devedor
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {debtorStats.map((debtor, index) => (
              <div key={index} className="p-4 bg-muted/30 rounded-lg">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{debtor.devedor}</h3>
                    <div className="text-sm text-muted-foreground">
                      {debtor.emprestimosAtivos} empréstimo(s) ativo(s)
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-lg font-bold text-primary">
                        {formatCurrency(debtor.totalEmprestado)}
                      </div>
                      <div className="text-xs text-muted-foreground">Total Emprestado</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-success">
                        {formatCurrency(debtor.rendimentoMensal)}
                      </div>
                      <div className="text-xs text-muted-foreground">Rendimento Mensal</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold">
                        {((debtor.rendimentoMensal / debtor.totalEmprestado) * 100).toFixed(2)}%
                      </div>
                      <div className="text-xs text-muted-foreground">Taxa Efetiva</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {debtorStats.length === 0 && (
              <div className="text-center py-8">
                <PieChart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Nenhum dado disponível para análise
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {debtorStats.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Melhor Devedor</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">
                {debtorStats.reduce((best, current) => 
                  current.rendimentoMensal > best.rendimentoMensal ? current : best
                ).devedor}
              </div>
              <div className="text-sm text-muted-foreground">
                Maior rendimento mensal
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Devedores</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{debtorStats.length}</div>
              <div className="text-sm text-muted-foreground">
                {debtorStats.filter(d => d.emprestimosAtivos > 0).length} com empréstimos ativos
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rendimento Total</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                {formatCurrency(debtorStats.reduce((sum, debtor) => sum + debtor.rendimentoMensal, 0))}
              </div>
              <div className="text-sm text-muted-foreground">Por mês</div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Reports;