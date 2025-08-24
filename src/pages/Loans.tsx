import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/StatusBadge';
import { supabase } from '@/integrations/supabase/client';
import { Emprestimo, LoanStatus } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Search, 
  Filter,
  Loader2,
  Edit,
  Trash2,
  DollarSign,
  Users,
  TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const Loans = () => {
  const [loans, setLoans] = useState<any[]>([]);
  const [filteredLoans, setFilteredLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<LoanStatus | 'all'>('all');
  const { toast } = useToast();

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const loadLoans = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('emprestimos')
        .select(`
          *,
          emprestimo_parceiros:emprestimo_parceiros(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setLoans(data || []);
      setFilteredLoans(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar empréstimos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este empréstimo?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('emprestimos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Empréstimo excluído",
        description: "O empréstimo foi removido com sucesso.",
      });

      loadLoans();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Filter loans based on search and status
  useEffect(() => {
    let filtered = loans;

    if (searchTerm) {
      filtered = filtered.filter(loan => 
        loan.devedor.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(loan => loan.status === statusFilter);
    }

    setFilteredLoans(filtered);
  }, [loans, searchTerm, statusFilter]);

  useEffect(() => {
    loadLoans();
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Empréstimos</h1>
          <p className="text-muted-foreground">Gerencie todos os seus empréstimos</p>
        </div>
        <Button asChild>
          <Link to="/loans/new">
            <Plus className="w-4 h-4 mr-2" />
            Novo Empréstimo
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar por devedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value: LoanStatus | 'all') => setStatusFilter(value)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="finalizado">Finalizados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Loans List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredLoans.map((loan) => {
          const taxaInvestidores = (loan.taxa_total || loan.taxa_mensal) - (loan.taxa_intermediador || 0);
          const rendimentoTotal = (loan.rendimento_total || loan.rendimento_mensal || 0);
          const rendimentoIntermediador = loan.rendimento_intermediador || 0;
          const rendimentoInvestidores = rendimentoTotal - rendimentoIntermediador;
          
          return (
            <Card key={loan.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{loan.devedor}</CardTitle>
                  <StatusBadge status={loan.status} />
                </div>
                <CardDescription>
                  Emprestado em {format(new Date(loan.data_emprestimo), 'dd/MM/yyyy', { locale: ptBR })}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Informações Gerais */}
                <div className="grid grid-cols-2 gap-4 text-sm bg-muted/30 p-3 rounded">
                  <div>
                    <span className="text-muted-foreground">Valor Total:</span>
                    <p className="font-semibold text-lg">{formatCurrency(loan.valor_total)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Taxa Total:</span>
                    <p className="font-semibold text-lg">{loan.taxa_total || loan.taxa_mensal}%</p>
                  </div>
                </div>

                {/* Rendimento Total */}
                <div className="text-center bg-primary/10 p-3 rounded">
                  <div className="text-muted-foreground text-sm">Rendimento Mensal Total</div>
                  <div className="text-xl font-bold text-primary">
                    {formatCurrency(rendimentoTotal)}
                  </div>
                </div>

                {/* Intermediador */}
                {loan.taxa_intermediador > 0 && loan.intermediador_nome && (
                  <div className="bg-warning/10 border border-warning/20 p-3 rounded">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-warning" />
                      <span className="font-medium text-sm">Intermediador</span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Nome:</span>
                        <span className="font-medium">{loan.intermediador_nome}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Taxa:</span>
                        <span className="font-medium">{loan.taxa_intermediador}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Rendimento:</span>
                        <span className="font-bold text-warning">
                          {formatCurrency(rendimentoIntermediador)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Parceiros/Investidores */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-success" />
                    <span className="font-medium text-sm">
                      Investidores ({taxaInvestidores.toFixed(1)}%)
                    </span>
                    <span className="ml-auto font-bold text-success text-sm">
                      {formatCurrency(rendimentoInvestidores)}
                    </span>
                  </div>
                  
                  {loan.emprestimo_parceiros && loan.emprestimo_parceiros.length > 0 ? (
                    <div className="space-y-2">
                      {loan.emprestimo_parceiros.map((parceiro: any, index: number) => {
                        const rendimentoParceiro = (parceiro.valor_investido * taxaInvestidores) / 100;
                        const percentualDoTotal = (parceiro.valor_investido / loan.valor_total) * 100;
                        
                        return (
                          <div key={parceiro.id || index} className="bg-success/5 border border-success/20 p-2 rounded text-xs">
                            <div className="flex justify-between items-center">
                              <div className="flex-1">
                                <div className="font-medium text-green-800 dark:text-green-200">
                                  👤 {parceiro.nome_parceiro}
                                </div>
                                <div className="text-muted-foreground">
                                  {formatCurrency(parceiro.valor_investido)} ({percentualDoTotal.toFixed(1)}% do total)
                                </div>
                                <div className="text-muted-foreground">
                                  Participação nos lucros: {parceiro.percentual_participacao.toFixed(1)}%
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-success">
                                  {formatCurrency(rendimentoParceiro)}
                                </div>
                                <div className="text-muted-foreground">por mês</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    // Fallback para empréstimos antigos sem parceiros detalhados
                    <div className="bg-success/5 border border-success/20 p-2 rounded text-xs">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-muted-foreground">Sua Parte:</div>
                          <div className="font-semibold">{formatCurrency(loan.valor_seu || 0)}</div>
                          <div className="text-success font-bold">
                            {formatCurrency(loan.seu_rendimento || 0)}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Parceiro:</div>
                          <div className="font-semibold">{formatCurrency(loan.valor_parceiro || 0)}</div>
                          <div className="text-success font-bold">
                            {formatCurrency(loan.parceiro_rendimento || 0)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Botões de Ação */}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    <Edit className="w-4 h-4 mr-2" />
                    Editar
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => handleDelete(loan.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredLoans.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              {loans.length === 0 ? 'Nenhum empréstimo cadastrado' : 'Nenhum empréstimo encontrado'}
            </p>
            <p className="text-muted-foreground text-center mb-4">
              {loans.length === 0 
                ? 'Comece cadastrando seu primeiro empréstimo' 
                : 'Tente ajustar os filtros de busca'
              }
            </p>
            {loans.length === 0 && (
              <Button asChild>
                <Link to="/loans/new">
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Primeiro Empréstimo
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Loans;