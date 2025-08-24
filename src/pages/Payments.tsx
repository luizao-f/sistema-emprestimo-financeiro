import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/StatusBadge';
import { supabase } from '@/integrations/supabase/client';
import { Recebimento } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { 
  Receipt, 
  Calendar, 
  Search,
  Check,
  Clock,
  AlertTriangle,
  Loader2 
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const Payments = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const loadPayments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('recebimentos')
        .select(`
          *,
          emprestimo:emprestimos!inner(devedor, taxa_mensal)
        `)
        .order('data_vencimento', { ascending: true });

      if (error) throw error;
      
      setPayments(data || []);
      setFilteredPayments(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar recebimentos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const markAsPaid = async (paymentId: string, valorRecebido: number) => {
    try {
      const { error } = await supabase
        .from('recebimentos')
        .update({
          status: 'pago',
          data_recebimento: new Date().toISOString().split('T')[0],
          valor_recebido: valorRecebido
        })
        .eq('id', paymentId);

      if (error) throw error;

      toast({
        title: "Pagamento registrado",
        description: "O recebimento foi marcado como pago.",
      });

      loadPayments();
    } catch (error: any) {
      toast({
        title: "Erro ao registrar pagamento",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pago':
        return <Check className="h-4 w-4 text-success" />;
      case 'pendente':
        return <Clock className="h-4 w-4 text-warning" />;
      case 'atrasado':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default:
        return <Receipt className="h-4 w-4" />;
    }
  };

  const isOverdue = (dueDate: string, status: string) => {
    return new Date(dueDate) < new Date() && status === 'pendente';
  };

  // Filter payments based on search
  useEffect(() => {
    let filtered = payments;

    if (searchTerm) {
      filtered = filtered.filter(payment => 
        payment.emprestimo?.devedor?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredPayments(filtered);
  }, [payments, searchTerm]);

  useEffect(() => {
    loadPayments();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const pendingPayments = filteredPayments.filter(p => p.status === 'pendente');
  const paidPayments = filteredPayments.filter(p => p.status === 'pago');
  const overduePayments = filteredPayments.filter(p => isOverdue(p.data_vencimento, p.status));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Recebimentos</h1>
        <p className="text-muted-foreground">Controle todos os pagamentos esperados e recebidos</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagamentos Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingPayments.length}</div>
            <div className="text-sm text-muted-foreground">
              {formatCurrency(pendingPayments.reduce((sum, p) => sum + p.valor_esperado, 0))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagamentos em Atraso</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{overduePayments.length}</div>
            <div className="text-sm text-muted-foreground">
              {formatCurrency(overduePayments.reduce((sum, p) => sum + p.valor_esperado, 0))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagamentos Realizados</CardTitle>
            <Check className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{paidPayments.length}</div>
            <div className="text-sm text-muted-foreground">
              {formatCurrency(paidPayments.reduce((sum, p) => sum + (p.valor_recebido || 0), 0))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar por devedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Payments List */}
      <div className="space-y-4">
        {filteredPayments.map((payment) => (
          <Card key={payment.id} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  {getStatusIcon(payment.status)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{payment.emprestimo?.devedor || 'N/A'}</h3>
                      <StatusBadge status={payment.status} />
                      {isOverdue(payment.data_vencimento, payment.status) && (
                        <span className="text-xs bg-destructive text-destructive-foreground px-2 py-1 rounded">
                          Atrasado
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      <div>Vencimento: {format(new Date(payment.data_vencimento), 'dd/MM/yyyy', { locale: ptBR })}</div>
                      {payment.data_recebimento && (
                        <div>Pago em: {format(new Date(payment.data_recebimento), 'dd/MM/yyyy', { locale: ptBR })}</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Valor Esperado</div>
                      <div className="font-semibold">{formatCurrency(payment.valor_esperado)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Sua Parte</div>
                      <div className="font-semibold text-success">{formatCurrency(payment.seu_valor)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Parte do Parceiro</div>
                      <div className="font-semibold text-primary">{formatCurrency(payment.parceiro_valor)}</div>
                    </div>
                  </div>

                  {payment.status === 'pendente' && (
                    <Button
                      onClick={() => markAsPaid(payment.id, payment.valor_esperado)}
                      size="sm"
                      className="whitespace-nowrap"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Marcar como Pago
                    </Button>
                  )}

                  {payment.status === 'pago' && payment.valor_recebido && (
                    <div className="text-sm">
                      <div className="text-muted-foreground">Valor Recebido</div>
                      <div className="font-semibold text-success">
                        {formatCurrency(payment.valor_recebido)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredPayments.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              {payments.length === 0 ? 'Nenhum recebimento encontrado' : 'Nenhum recebimento encontrado'}
            </p>
            <p className="text-muted-foreground text-center">
              {payments.length === 0 
                ? 'Cadastre empréstimos para gerar recebimentos automaticamente' 
                : 'Tente ajustar os filtros de busca'
              }
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Payments;