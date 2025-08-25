import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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
  TrendingUp,
  Target,
  Calendar,
  Percent,
  PieChart,
  BarChart,
  X,
  UserCheck
} from 'lucide-react';
import { format, differenceInMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const Loans = () => {
  const [loans, setLoans] = useState<any[]>([]);
  const [filteredLoans, setFilteredLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<LoanStatus | 'all'>('all');
  const [investidorFilter, setInvestidorFilter] = useState<string>('');
  const [devedorFilter, setDevedorFilter] = useState<string>('');
  const { toast } = useToast();

  // Hook para capturar filtros do Dashboard
  const location = useLocation();
  const filtroInvestidorDashboard = location.state?.filtroInvestidor;
  const filtroDevedorDashboard = location.state?.filtroDevedor;

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatPercent = (value: number) => {
    return `${Math.round(value * 100) / 100}%`;
  };

  const calcularROI = (emprestimo: any) => {
    const mesesPassados = differenceInMonths(new Date(), new Date(emprestimo.data_emprestimo));
    const rendimentoTotal = (emprestimo.rendimento_total || emprestimo.rendimento_mensal || 0) * Math.max(mesesPassados, 1);
    const roi = emprestimo.valor_total > 0 ? (rendimentoTotal / emprestimo.valor_total) * 100 : 0;
    return { roi, mesesPassados, rendimentoAcumulado: rendimentoTotal };
  };

  const loadLoans = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('emprestimos')
        .select(`
          id,
          devedor,
          valor_total,
          taxa_mensal,
          taxa_total,
          taxa_intermediador,
          intermediador_nome,
          rendimento_mensal,
          rendimento_total,
          rendimento_intermediador,
          data_emprestimo,
          data_vencimento,
          tipo_pagamento,
          status,
          observacoes,
          valor_seu,
          valor_parceiro,
          seu_rendimento,
          parceiro_rendimento,
          created_at,
          emprestimo_parceiros:emprestimo_parceiros(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      console.log('Empréstimos carregados:', data);
      setLoans(data || []);
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

  // Aplicar filtros vindos do Dashboard
  useEffect(() => {
    if (filtroInvestidorDashboard) {
      setInvestidorFilter(filtroInvestidorDashboard);
      console.log('Filtro de investidor aplicado:', filtroInvestidorDashboard);
    }
    
    if (filtroDevedorDashboard) {
      setDevedorFilter(filtroDevedorDashboard);
      setSearchTerm(filtroDevedorDashboard);
      console.log('Filtro de devedor aplicado:', filtroDevedorDashboard);
    }
  }, [filtroInvestidorDashboard, filtroDevedorDashboard]);

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

  // Função para verificar se um empréstimo tem um investidor específico
  const emprestimoTemInvestidor = (loan: any, nomeInvestidor: string) => {
    if (!loan.emprestimo_parceiros || loan.emprestimo_parceiros.length === 0) {
      return false;
    }
    
    return loan.emprestimo_parceiros.some((parceiro: any) => 
      parceiro.nome_parceiro.toLowerCase().includes(nomeInvestidor.toLowerCase())
    );
  };

  // Função para limpar filtros específicos
  const limparFiltroInvestidor = () => {
    setInvestidorFilter('');
    window.history.replaceState({}, document.title);
  };

  const limparFiltroDevedor = () => {
    setDevedorFilter('');
    setSearchTerm('');
    window.history.replaceState({}, document.title);
  };

  // Filter loans com novos filtros
  useEffect(() => {
    let filtered = loans;

    // Filtro por devedor (busca texto)
    if (searchTerm || devedorFilter) {
      const termoBusca = searchTerm || devedorFilter;
      filtered = filtered.filter(loan => 
        loan.devedor.toLowerCase().includes(termoBusca.toLowerCase())
      );
    }

    // Filtro por status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(loan => loan.status === statusFilter);
    }

    // Filtro por investidor
    if (investidorFilter) {
      filtered = filtered.filter(loan => emprestimoTemInvestidor(loan, investidorFilter));
    }

    setFilteredLoans(filtered);
  }, [loans, searchTerm, statusFilter, investidorFilter, devedorFilter]);

  useEffect(() => {
    loadLoans();
  }, []);

  // Calcular estatísticas gerais
  const statsGerais = {
    totalEmprestado: filteredLoans.reduce((sum, loan) => sum + (loan.valor_total || 0), 0),
    rendimentoMensalTotal: filteredLoans.reduce((sum, loan) => sum + (loan.rendimento_total || loan.rendimento_mensal || 0), 0),
    emprestimosAtivos: filteredLoans.filter(loan => loan.status === 'ativo').length,
    taxaMediaPonderada: 0
  };

  if (statsGerais.totalEmprestado > 0) {
    statsGerais.taxaMediaPonderada = (statsGerais.rendimentoMensalTotal / statsGerais.totalEmprestado) * 100;
  }

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
          <p className="text-muted-foreground">
            Gerencie todos os seus empréstimos com análises detalhadas
            {(investidorFilter || devedorFilter) && (
              <span className="text-blue-600 font-medium">
                {investidorFilter && ` • Filtrado por investidor: ${investidorFilter}`}
                {devedorFilter && ` • Filtrado por devedor: ${devedorFilter}`}
              </span>
            )}
          </p>
        </div>
        <Button asChild>
          <Link to="/loans/new">
            <Plus className="w-4 h-4 mr-2" />
            Novo Empréstimo
          </Link>
        </Button>
      </div>

      {/* Indicadores de Filtros Ativos */}
      {(investidorFilter || devedorFilter) && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Filtros ativos:</span>
              
              {investidorFilter && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <UserCheck className="h-3 w-3" />
                  Investidor: {investidorFilter}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                    onClick={limparFiltroInvestidor}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              
              {devedorFilter && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Devedor: {devedorFilter}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                    onClick={limparFiltroDevedor}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estatísticas Gerais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Capital Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(statsGerais.totalEmprestado)}
            </div>
            <p className="text-xs text-muted-foreground">
              Em {filteredLoans.length} empréstimos
              {(investidorFilter || devedorFilter) && ' (filtrados)'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rendimento Mensal</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(statsGerais.rendimentoMensalTotal)}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatPercent(statsGerais.taxaMediaPonderada)} efetivo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ativos</CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {statsGerais.emprestimosAtivos}
            </div>
            <p className="text-xs text-muted-foreground">
              De {filteredLoans.length} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {filteredLoans.length > 0 ? formatCurrency(statsGerais.totalEmprestado / filteredLoans.length) : formatCurrency(0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Por empréstimo
            </p>
          </CardContent>
        </Card>
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
            
            {/* Campo de filtro por investidor */}
            <div className="relative">
              <UserCheck className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Filtrar por investidor..."
                value={investidorFilter}
                onChange={(e) => setInvestidorFilter(e.target.value)}
                className="pl-10 w-full sm:w-[200px]"
              />
            </div>
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
          const { roi, mesesPassados, rendimentoAcumulado } = calcularROI(loan);
          
          // Destacar se o empréstimo está sendo filtrado
          const isDestaque = (investidorFilter && emprestimoTemInvestidor(loan, investidorFilter)) || 
                            (devedorFilter && loan.devedor.toLowerCase().includes(devedorFilter.toLowerCase()));
          
          return (
            <Card 
              key={loan.id} 
              className={`hover:shadow-lg transition-all duration-200 border-l-4 ${
                isDestaque ? 'border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/10' : 'border-l-primary'
              }`}
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className={`text-xl ${isDestaque ? 'text-blue-600' : 'text-primary'}`}>
                      {loan.devedor}
                      {isDestaque && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          Filtrado
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1 flex-wrap">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Emprestado em {format(new Date(loan.data_emprestimo), 'dd/MM/yyyy', { locale: ptBR })}
                      </div>
                      {loan.data_vencimento && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          Vence em {format(new Date(loan.data_vencimento), 'dd/MM/yyyy', { locale: ptBR })}
                        </div>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {mesesPassados} meses
                      </Badge>
                    </CardDescription>
                  </div>
                  <StatusBadge status={loan.status} />
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Métricas Principais */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-primary/10 rounded-lg">
                    <div className="text-sm text-muted-foreground">Capital</div>
                    <div className="text-lg font-bold text-primary">
                      {formatCurrency(loan.valor_total)}
                    </div>
                  </div>
                  <div className="text-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                    <div className="text-sm text-muted-foreground">Taxa</div>
                    <div className="text-lg font-bold text-green-600">
                      {formatPercent(loan.taxa_total || loan.taxa_mensal)} a.m.
                    </div>
                  </div>
                </div>

                {/* Rendimento e ROI */}
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Rendimento Mensal Total</span>
                    <span className="text-lg font-bold text-success">
                      {formatCurrency(rendimentoTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">ROI Acumulado ({mesesPassados} meses)</span>
                    <span className="font-bold text-blue-600">
                      {formatPercent(roi)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm mt-1">
                    <span className="text-muted-foreground">Rendimento Acumulado</span>
                    <span className="font-bold text-green-600">
                      {formatCurrency(rendimentoAcumulado)}
                    </span>
                  </div>
                </div>

                {/* Intermediador */}
                {loan.taxa_intermediador > 0 && loan.intermediador_nome && (
                  <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="w-4 h-4 text-purple-600" />
                      <span className="font-semibold text-sm text-purple-800 dark:text-purple-200">
                        Intermediador
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{loan.intermediador_nome}</span>
                        <Badge variant="secondary">{formatPercent(loan.taxa_intermediador)}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Rendimento Mensal</span>
                        <span className="font-bold text-purple-600">
                          {formatCurrency(rendimentoIntermediador)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Acumulado ({mesesPassados} meses)</span>
                        <span className="font-bold text-purple-600">
                          {formatCurrency(rendimentoIntermediador * mesesPassados)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Investidores */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-green-600" />
                      <span className="font-semibold text-sm">
                        Investidores ({formatPercent((taxaInvestidores / (loan.taxa_total || loan.taxa_mensal)) * 100)})
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-600 text-sm">
                        {formatCurrency(rendimentoInvestidores)}/mês
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatCurrency(rendimentoInvestidores * mesesPassados)} acumulado
                      </div>
                    </div>
                  </div>
                  
                  {loan.emprestimo_parceiros && loan.emprestimo_parceiros.length > 0 ? (
                    <div className="space-y-2">
                      {loan.emprestimo_parceiros.map((parceiro: any, index: number) => {
                        const rendimentoMensalParceiro = (parceiro.valor_investido * taxaInvestidores) / 100;
                        const rendimentoAcumuladoParceiro = rendimentoMensalParceiro * mesesPassados;
                        const roiParceiro = ((rendimentoAcumuladoParceiro / parceiro.valor_investido) * 100);
                        const participacaoCapital = (parceiro.valor_investido / loan.valor_total) * 100;
                        
                        // Destacar investidor se estiver sendo filtrado
                        const isInvestidorDestaque = investidorFilter && 
                          parceiro.nome_parceiro.toLowerCase().includes(investidorFilter.toLowerCase());
                        
                        return (
                          <div 
                            key={parceiro.id || index} 
                            className={`border rounded-lg p-3 ${
                              isInvestidorDestaque 
                                ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-700' 
                                : 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                            }`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`font-medium ${
                                    isInvestidorDestaque 
                                      ? 'text-blue-800 dark:text-blue-200' 
                                      : 'text-green-800 dark:text-green-200'
                                  }`}>
                                    {parceiro.nome_parceiro}
                                    {isInvestidorDestaque && (
                                      <Badge variant="secondary" className="ml-1 text-xs">
                                        Filtrado
                                      </Badge>
                                    )}
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    {formatPercent(participacaoCapital)} do capital
                                  </Badge>
                                </div>
                                <div className="text-sm text-muted-foreground mt-1">
                                  Capital: {formatCurrency(parceiro.valor_investido)} • 
                                  Participação: {formatPercent(parceiro.percentual_participacao)}
                                </div>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <div className="text-muted-foreground">Mensal</div>
                                <div className={`font-bold ${
                                  isInvestidorDestaque ? 'text-blue-600' : 'text-green-600'
                                }`}>
                                  {formatCurrency(rendimentoMensalParceiro)}
                                </div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">Acumulado</div>
                                <div className={`font-bold ${
                                  isInvestidorDestaque ? 'text-blue-600' : 'text-green-600'
                                }`}>
                                  {formatCurrency(rendimentoAcumuladoParceiro)}
                                </div>
                              </div>
                            </div>
                            
                            <div className={`flex justify-between items-center mt-2 pt-2 border-t ${
                              isInvestidorDestaque 
                                ? 'border-blue-200 dark:border-blue-800' 
                                : 'border-green-200 dark:border-green-800'
                            }`}>
                              <span className="text-sm text-muted-foreground">ROI</span>
                              <span className={`font-bold ${
                                isInvestidorDestaque 
                                  ? 'text-blue-700 dark:text-blue-300' 
                                  : 'text-green-700 dark:text-green-300'
                              }`}>
                                {formatPercent(roiParceiro)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    // Fallback para empréstimos antigos
                    <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Sua Parte</div>
                          <div className="font-semibold">{formatCurrency(loan.valor_seu || 0)}</div>
                          <div className="font-bold text-success">
                            {formatCurrency(loan.seu_rendimento || 0)}/mês
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Parceiro</div>
                          <div className="font-semibold">{formatCurrency(loan.valor_parceiro || 0)}</div>
                          <div className="font-bold text-success">
                            {formatCurrency(loan.parceiro_rendimento || 0)}/mês
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Informações Adicionais */}
                <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between items-center text-sm text-muted-foreground">
                    <span>Tipo de Pagamento</span>
                    <Badge variant="outline">
                      {loan.tipo_pagamento || 'Mensal'}
                    </Badge>
                  </div>
                  {loan.observacoes && (
                    <div className="mt-2 text-sm">
                      <span className="text-muted-foreground">Obs: </span>
                      <span className="text-foreground">{loan.observacoes}</span>
                    </div>
                  )}
                </div>

                {/* Botões de Ação */}
                <div className="flex gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    asChild
                  >
                    <Link to={`/loans/edit/${loan.id}`}>
                      <Edit className="w-4 h-4 mr-2" />
                      Editar
                    </Link>
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => {
                      console.log('Deletar empréstimo ID:', loan.id);
                      handleDelete(loan.id);
                    }}
                    className="px-3"
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
                : investidorFilter || devedorFilter
                ? 'Nenhum empréstimo encontrado com os filtros aplicados. Tente limpar os filtros.'
                : 'Tente ajustar os filtros de busca'
              }
            </p>
            {loans.length === 0 ? (
              <Button asChild>
                <Link to="/loans/new">
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Primeiro Empréstimo
                </Link>
              </Button>
            ) : (investidorFilter || devedorFilter) && (
              <div className="flex gap-2">
                {investidorFilter && (
                  <Button variant="outline" onClick={limparFiltroInvestidor}>
                    Limpar Filtro de Investidor
                  </Button>
                )}
                {devedorFilter && (
                  <Button variant="outline" onClick={limparFiltroDevedor}>
                    Limpar Filtro de Devedor
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Loans;