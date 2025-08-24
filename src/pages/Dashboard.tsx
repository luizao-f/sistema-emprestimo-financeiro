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
  Loader2 
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DashboardStats {
  totalEmprestado: number;
  rendimentoMensal: number;
  proximosRecebimentos: number;
  emprestimosAtivos: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalEmprestado: 0,
    rendimentoMensal: 0,
    proximosRecebimentos: 0,
    emprestimosAtivos: 0,
  });
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

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load loans data
      const { data: loans, error: loansError } = await supabase
        .from('emprestimos')
        .select('*')
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
        .limit(5);

      if (paymentsError) throw paymentsError;

      // Calculate stats
      const activeLoans = loans?.filter(loan => loan.status === 'ativo') || [];
      const totalEmprestado = activeLoans.reduce((sum, loan) => sum + (loan.valor_total || 0), 0);
      const rendimentoMensal = activeLoans.reduce((sum, loan) => sum + (loan.rendimento_mensal || 0), 0);
      const emprestimosAtivos = activeLoans.length;

      // Get upcoming payments (next 30 days)
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      
      const upcomingPaymentsValue = payments?.filter(payment => {
        const paymentDate = new Date(payment.data_vencimento);
        return paymentDate <= thirtyDaysFromNow && payment.status === 'pendente';
      }).reduce((sum, payment) => sum + (payment.valor_esperado || 0), 0) || 0;

      setStats({
        totalEmprestado,
        rendimentoMensal,
        proximosRecebimentos: upcomingPaymentsValue,
        emprestimosAtivos,
      });

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
        <p className="text-muted-foreground">Visão geral dos seus investimentos</p>
      </div>

      {/* Stats Cards */}
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rendimento Mensal</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {formatCurrency(stats.rendimentoMensal)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Próximos Recebimentos</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              {formatCurrency(stats.proximosRecebimentos)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Empréstimos Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.emprestimosAtivos}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Loans and Upcoming Payments */}
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