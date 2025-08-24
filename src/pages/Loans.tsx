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
  DollarSign
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const Loans = () => {
  const [loans, setLoans] = useState<Emprestimo[]>([]);
  const [filteredLoans, setFilteredLoans] = useState<Emprestimo[]>([]);
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
        {filteredLoans.map((loan) => (
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
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Valor Total:</span>
                  <p className="font-semibold">{formatCurrency(loan.valor_total)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Taxa Mensal:</span>
                  <p className="font-semibold">{loan.taxa_mensal}%</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Sua Parte:</span>
                  <p className="font-semibold">{formatCurrency(loan.valor_seu)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Parceiro:</span>
                  <p className="font-semibold">{formatCurrency(loan.valor_parceiro)}</p>
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-muted-foreground text-sm">Rendimento Mensal</div>
                <div className="text-lg font-bold text-success">
                  {formatCurrency(loan.rendimento_mensal || 0)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Seu: {formatCurrency(loan.seu_rendimento || 0)} | 
                  Parceiro: {formatCurrency(loan.parceiro_rendimento || 0)}
                </div>
              </div>

              <div className="flex gap-2">
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
        ))}
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