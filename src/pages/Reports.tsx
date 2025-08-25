import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
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
  Loader2
} from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, parseISO, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ParcelaCalculada {
  id: string;
  emprestimoId: string;
  devedor: string;
  valor: number;
  dataVencimento: Date;
  tipo: 'mensal' | 'trimestral' | 'anual';
  status: 'pendente' | 'pago' | 'atrasado';
  investidores: any[];
  taxaIntermediador: number;
  rendimentoIntermediador: number;
  rendimentoInvestidores: number;
  valorRecebido?: number; // Adicionar campo para valor já recebido
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

  const calcularDistribuicaoPagamento = (parcela: ParcelaCalculada, valorPago: number) => {
    if (!valorPago || valorPago <= 0) {
      return { intermediador: 0, investidores: {} };
    }

    // Calcular proporção do pagamento em relação ao valor total
    const proporcao = Math.min(valorPago / parcela.valor, 1); // Não permitir mais que 100%
    
    const intermediador = parcela.rendimentoIntermediador * proporcao;
    const investidores: Record<string, number> = {};

    if (parcela.investidores && parcela.investidores.length > 0) {
      parcela.investidores.forEach((inv: any) => {
        const valorInvestidor = (parcela.rendimentoInvestidores * inv.percentual_participacao / 100) * proporcao;
        investidores[inv.nome_parceiro] = valorInvestidor;
      });
    } else {
      investidores["Investidores"] = parcela.rendimentoInvestidores * proporcao;
    }

    return { intermediador, investidores };
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const atualizarDistribuicao = (valorStr: string, parcela: ParcelaCalculada | null) => {
    const valor = parseFloat(valorStr) || 0;
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
      
      // Calcular quantos períodos se passaram desde o empréstimo até o mês atual
      let numeroMes = 0;
      let proximoPagamento = calcularProximoPagamento(dataEmprestimo, tipoPagamento, numeroMes);
      
      // Verificar se há pagamento no mês selecionado
      while (proximoPagamento <= fimMes && numeroMes < 120) { // limite de 120 parcelas (10 anos)
        if (proximoPagamento >= inicioMes && proximoPagamento <= fimMes) {
          // CORREÇÃO: Calcular rendimento baseado na frequência de pagamento
          const taxaMensal = emprestimo.taxa_mensal || 0;
          const taxaIntermediador = emprestimo.taxa_intermediador || 0;
          const taxaInvestidores = taxaMensal - taxaIntermediador;
          
          let rendimentoTotal = 0;
          let mesesAcumulados = 1;
          
          // Calcular rendimento baseado no tipo de pagamento
          if (tipoPagamento === 'trimestral') {
            mesesAcumulados = 3;
          } else if (tipoPagamento === 'anual') {
            mesesAcumulados = 12;
          }
          
          // O rendimento é sempre calculado como taxa mensal × meses acumulados
          rendimentoTotal = emprestimo.valor_total * (taxaMensal / 100) * mesesAcumulados;
          const rendimentoIntermediador = emprestimo.valor_total * (taxaIntermediador / 100) * mesesAcumulados;
          const rendimentoInvestidores = emprestimo.valor_total * (taxaInvestidores / 100) * mesesAcumulados;

          const parcela: ParcelaCalculada = {
            id: `${emprestimo.id}-${numeroMes}`,
            emprestimoId: emprestimo.id,
            devedor: emprestimo.devedor,
            valor: rendimentoTotal,
            dataVencimento: proximoPagamento,
            tipo: tipoPagamento as 'mensal' | 'trimestral' | 'anual',
            status: 'pendente',
            investidores: emprestimo.emprestimo_parceiros || [],
            taxaIntermediador,
            rendimentoIntermediador,
            rendimentoInvestidores,
            valorRecebido: 0
          };

          // CORREÇÃO: Melhor lógica para verificar pagamentos
          // Buscar pagamentos para este empréstimo no mês/ano da parcela
          const pagamentosEmprestimo = pagamentosRecebidos.filter(p => {
            if (p.emprestimo_id !== emprestimo.id) return false;
            
            const dataVencimentoPagamento = new Date(p.data_vencimento);
            return dataVencimentoPagamento.getMonth() === proximoPagamento.getMonth() &&
                   dataVencimentoPagamento.getFullYear() === proximoPagamento.getFullYear();
          });

          if (pagamentosEmprestimo.length > 0) {
            // Somar todos os pagamentos para esta parcela
            const valorTotalRecebido = pagamentosEmprestimo.reduce((sum, p) => 
              sum + (parseFloat(p.valor_recebido) || 0), 0);
            
            parcela.valorRecebido = valorTotalRecebido;
            
            // Determinar status baseado no valor recebido vs valor esperado
            if (valorTotalRecebido >= rendimentoTotal * 0.99) { // 99% para considerar tolerância
              parcela.status = 'pago';
            } else if (valorTotalRecebido > 0) {
              parcela.status = 'pendente'; // Parcialmente pago, mas ainda pendente
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

    // Calcular por investidor
    const porInvestidor: Record<string, { previsto: number; recebido: number; pendente: number }> = {};
    
    parcelasMes.forEach(parcela => {
      if (parcela.investidores && parcela.investidores.length > 0) {
        // Usar os percentuais cadastrados dos investidores
        parcela.investidores.forEach((inv: any) => {
          const nome = inv.nome_parceiro;
          // Calcular baseado no percentual de participação cadastrado
          const valorPrevistoInvestidor = (parcela.rendimentoInvestidores * inv.percentual_participacao) / 100;
          const valorRecebidoInvestidor = parcela.status === 'pago' ? valorPrevistoInvestidor : 
            (parcela.valorRecebido || 0) > 0 ? (valorPrevistoInvestidor * (parcela.valorRecebido || 0)) / parcela.valor : 0;
          
          if (!porInvestidor[nome]) {
            porInvestidor[nome] = { previsto: 0, recebido: 0, pendente: 0 };
          }
          
          porInvestidor[nome].previsto += valorPrevistoInvestidor;
          porInvestidor[nome].recebido += valorRecebidoInvestidor;
          porInvestidor[nome].pendente = porInvestidor[nome].previsto - porInvestidor[nome].recebido;
        });
      } else {
        // Fallback para empréstimos sem investidores cadastrados
        const nomeGenerico = "Investidores";
        if (!porInvestidor[nomeGenerico]) {
          porInvestidor[nomeGenerico] = { previsto: 0, recebido: 0, pendente: 0 };
        }
        
        const valorRecebidoInvestidores = parcela.status === 'pago' ? parcela.rendimentoInvestidores :
          (parcela.valorRecebido || 0) > 0 ? (parcela.rendimentoInvestidores * (parcela.valorRecebido || 0)) / parcela.valor : 0;
        
        porInvestidor[nomeGenerico].previsto += parcela.rendimentoInvestidores;
        porInvestidor[nomeGenerico].recebido += valorRecebidoInvestidores;
        porInvestidor[nomeGenerico].pendente = porInvestidor[nomeGenerico].previsto - porInvestidor[nomeGenerico].recebido;
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

  const loadData = async () => {
    try {
      setLoading(true);

      // Carregar empréstimos com parceiros
      const { data: loansData, error: loansError } = await supabase
        .from('emprestimos')
        .select(`
          *,
          emprestimo_parceiros:emprestimo_parceiros(*)
        `);

      if (loansError) throw loansError;

      // CORREÇÃO: Carregar TODOS os pagamentos, não apenas os com status 'pago'
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('recebimentos')
        .select('*')
        .order('created_at', { ascending: false });

      if (paymentsError) throw paymentsError;

      console.log('Empréstimos carregados:', loansData?.length);
      console.log('Pagamentos carregados:', paymentsData?.length);
      console.log('Dados dos pagamentos:', paymentsData);

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
      const valor = parseFloat(valorPagamento);
      const parcela = modalPagamento.parcela;

      // VALIDAÇÃO: Não permitir valor maior que o restante a ser pago
      const valorRestante = parcela.valor - (parcela.valorRecebido || 0);
      if (valor > valorRestante + 0.01) { // Tolerância de 1 centavo
        toast({
          title: "Valor inválido",
          description: `O valor não pode ser maior que o restante a ser pago: ${formatCurrency(valorRestante)}`,
          variant: "destructive",
        });
        return;
      }

      if (valor <= 0) {
        toast({
          title: "Valor inválido",
          description: "O valor deve ser maior que zero.",
          variant: "destructive",
        });
        return;
      }

      // Verificar se já existe um registro para este empréstimo e data
      const { data: existingPayment } = await supabase
        .from('recebimentos')
        .select('*')
        .eq('emprestimo_id', parcela.emprestimoId)
        .eq('data_vencimento', format(parcela.dataVencimento, 'yyyy-MM-dd'))
        .single();

      let error;
      let novoValorTotal = valor;
      
      if (existingPayment) {
        // Se já existe, somar com o valor anterior
        novoValorTotal = (parseFloat(existingPayment.valor_recebido) || 0) + valor;
        
        // VALIDAÇÃO: Não permitir que o total exceda o valor esperado
        if (novoValorTotal > parcela.valor + 0.01) {
          toast({
            title: "Valor total inválido",
            description: `O valor total recebido (${formatCurrency(novoValorTotal)}) não pode exceder o valor esperado (${formatCurrency(parcela.valor)})`,
            variant: "destructive",
          });
          return;
        }
        
        const novoStatusFinal = novoValorTotal >= parcela.valor * 0.99 ? 'pago' : 'pendente';
        
        // Calcular nova distribuição total
        const novaDistribuicao = calcularDistribuicaoPagamento(parcela, novoValorTotal);
        
        const { error: updateError } = await supabase
          .from('recebimentos')
          .update({
            valor_recebido: novoValorTotal.toString(),
            status: novoStatusFinal,
            seu_valor: novaDistribuicao.intermediador.toString(),
            parceiro_valor: Object.values(novaDistribuicao.investidores).reduce((sum, val) => sum + val, 0).toString(),
            observacoes: `${existingPayment.observacoes || ''}\nPagamento adicional de ${formatCurrency(valor)} em ${new Date().toLocaleDateString('pt-BR')}. Total: ${formatCurrency(novoValorTotal)}`
          })
          .eq('id', existingPayment.id);
        
        error = updateError;
      } else {
        // Inserir novo registro
        const novoStatus = valor >= parcela.valor * 0.99 ? 'pago' : 'pendente';
        
        const { error: insertError } = await supabase
          .from('recebimentos')
          .insert({
            emprestimo_id: parcela.emprestimoId,
            data_vencimento: format(parcela.dataVencimento, 'yyyy-MM-dd'),
            valor_esperado: parcela.valor.toString(),
            valor_recebido: valor.toString(),
            status: novoStatus,
            seu_valor: distribuicaoPagamento.intermediador.toString(),
            parceiro_valor: Object.values(distribuicaoPagamento.investidores).reduce((sum, val) => sum + val, 0).toString(),
            observacoes: `Pagamento ${novoStatus === 'pago' ? 'completo' : 'parcial'} registrado em ${new Date().toLocaleDateString('pt-BR')}. Distribuição: Intermediador: ${formatCurrency(distribuicaoPagamento.intermediador)}, Investidores: ${Object.entries(distribuicaoPagamento.investidores).map(([nome, valor]) => `${nome}: ${formatCurrency(valor)}`).join(', ')}`
          });
        
        error = insertError;
      }

      if (error) throw error;

      toast({
        title: "Pagamento registrado",
        description: `Pagamento de ${formatCurrency(valor)} registrado com sucesso. Total recebido: ${formatCurrency(novoValorTotal)}`,
      });

      setModalPagamento({ aberto: false, parcela: null });
      setValorPagamento('');
      setDistribuicaoPagamento({ intermediador: 0, investidores: {} });
      
      // Recarregar dados após registrar pagamento
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
      <div>
        <h1 className="text-3xl font-bold text-foreground">Relatórios</h1>
        <p className="text-muted-foreground">Controle inteligente de recebimentos por período</p>
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
                  Baseado nas datas de cadastro dos empréstimos
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
                      <div className="flex items-center gap-3 mb-2">
                        {getStatusIcon(parcela.status)}
                        <h4 className="font-semibold text-lg">{parcela.devedor}</h4>
                        {getStatusBadge(parcela.status)}
                        {(parcela.valorRecebido || 0) > 0 && parcela.status !== 'pago' && (
                          <Badge variant="outline">
                            Recebido: {formatCurrency(parcela.valorRecebido || 0)}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Vencimento</p>
                          <p className="font-medium">
                            {format(parcela.dataVencimento, 'dd/MM/yyyy', { locale: ptBR })}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Tipo</p>
                          <p className="font-medium capitalize">{parcela.tipo}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Valor Total</p>
                          <p className="font-bold text-lg">{formatCurrency(parcela.valor)}</p>
                          {(parcela.valorRecebido || 0) > 0 && (
                            <p className="text-sm text-green-600">
                              Recebido: {formatCurrency(parcela.valorRecebido || 0)}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Distribuição */}
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
                        <h5 className="font-medium text-sm text-muted-foreground mb-3">Distribuição do Rendimento:</h5>
                        
                        {/* Intermediador */}
                        <div className="flex justify-between items-center py-2 border-b">
                          <span className="text-sm">Intermediador ({parcela.taxaIntermediador}% mensal)</span>
                          <span className="font-bold text-purple-600">
                            {formatCurrency(parcela.rendimentoIntermediador)}
                          </span>
                        </div>
                        
                        {/* Investidores */}
                        {parcela.investidores && parcela.investidores.length > 0 ? (
                          <>
                            {parcela.investidores.map((investidor: any, index: number) => {
                              const valorInvestidor = (parcela.rendimentoInvestidores * investidor.percentual_participacao) / 100;
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
                              // Sugerir o valor restante a ser pago
                              const valorRestante = parcela.valor - (parcela.valorRecebido || 0);
                              setValorPagamento(valorRestante.toString());
                              // Calcular distribuição inicial
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
                          <DialogContent>
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
                                  <p className="text-sm text-muted-foreground">Valor Esperado</p>
                                  <p className="font-medium">{formatCurrency(parcela.valor)}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Tipo</p>
                                  <p className="font-medium capitalize">{parcela.tipo}</p>
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
                                  type="number"
                                  step="0.01"
                                  max={parcela.valor - (parcela.valorRecebido || 0)}
                                  value={valorPagamento}
                                  onChange={(e) => {
                                    const novoValor = e.target.value;
                                    setValorPagamento(novoValor);
                                    atualizarDistribuicao(novoValor, parcela);
                                  }}
                                  placeholder="Digite o valor recebido"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                  Este valor será {(parcela.valorRecebido || 0) > 0 ? 'somado ao valor já recebido' : 'registrado como primeiro pagamento'}.
                                  Máximo: {formatCurrency(parcela.valor - (parcela.valorRecebido || 0))}
                                </p>
                              </div>

                              {/* Distribuição Detalhada */}
                              {parseFloat(valorPagamento) > 0 && (
                                <div className="border rounded-lg p-4 bg-muted/50">
                                  <h4 className="font-medium text-sm mb-3">Distribuição do Pagamento:</h4>
                                  
                                  {/* Intermediador */}
                                  <div className="space-y-3">
                                    <div className="flex justify-between items-center p-3 bg-purple-50 dark:bg-purple-950/20 rounded border">
                                      <div className="flex items-center gap-2">
                                        <Target className="h-4 w-4 text-purple-600" />
                                        <span className="text-sm font-medium">Intermediador ({parcela.taxaIntermediador}% mensal)</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Input
                                          type="number"
                                          step="0.01"
                                          value={distribuicaoPagamento.intermediador.toFixed(2)}
                                          onChange={(e) => {
                                            const novoValor = parseFloat(e.target.value) || 0;
                                            setDistribuicaoPagamento(prev => ({
                                              ...prev,
                                              intermediador: novoValor
                                            }));
                                          }}
                                          className="w-24 h-8 text-right text-sm"
                                        />
                                        <span className="text-sm font-bold text-purple-600 min-w-[80px]">
                                          {formatCurrency(distribuicaoPagamento.intermediador)}
                                        </span>
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
                                              {nome} {investidor && `(${percentual.toFixed(1)}%)`}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <Input
                                              type="number"
                                              step="0.01"
                                              value={valor.toFixed(2)}
                                              onChange={(e) => {
                                                const novoValor = parseFloat(e.target.value) || 0;
                                                setDistribuicaoPagamento(prev => ({
                                                  ...prev,
                                                  investidores: {
                                                    ...prev.investidores,
                                                    [nome]: novoValor
                                                  }
                                                }));
                                              }}
                                              className="w-24 h-8 text-right text-sm"
                                            />
                                            <span className="text-sm font-bold text-green-600 min-w-[80px]">
                                              {formatCurrency(valor)}
                                            </span>
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
                                        parseFloat(valorPagamento)
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

      {/* Distribuição por Investidor */}
      {Object.keys(resumoMes.porInvestidor).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Investidor</CardTitle>
            <CardDescription>
              Breakdown de rendimentos por parceiro investidor no mês
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(resumoMes.porInvestidor).map(([nome, valores]) => (
                <div key={nome} className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-green-600" />
                      <h4 className="font-semibold text-lg">{nome}</h4>
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
              
              {/* Card do Intermediador */}
              <div className="flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <Target className="h-5 w-5 text-purple-600" />
                    <h4 className="font-semibold text-lg">Intermediador</h4>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Previsto:</span>
                      <p className="font-bold text-blue-600">{formatCurrency(resumoMes.rendimentoIntermediador)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Recebido:</span>
                      <p className="font-bold text-green-600">
                        {formatCurrency(parcelasDoMes.filter(p => p.status === 'pago').reduce((sum, p) => sum + p.rendimentoIntermediador, 0) + 
                        parcelasDoMes.filter(p => p.status !== 'pago' && (p.valorRecebido || 0) > 0).reduce((sum, p) => sum + (p.rendimentoIntermediador * (p.valorRecebido || 0)) / p.valor, 0))}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Pendente:</span>
                      <p className="font-bold text-yellow-600">
                        {formatCurrency(resumoMes.rendimentoIntermediador - (parcelasDoMes.filter(p => p.status === 'pago').reduce((sum, p) => sum + p.rendimentoIntermediador, 0) + 
                        parcelasDoMes.filter(p => p.status !== 'pago' && (p.valorRecebido || 0) > 0).reduce((sum, p) => sum + (p.rendimentoIntermediador * (p.valorRecebido || 0)) / p.valor, 0)))}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <div className="text-sm text-muted-foreground">Progresso</div>
                  <div className="font-bold text-xl text-purple-600">
                    {(() => {
                      const totalIntermediador = resumoMes.rendimentoIntermediador;
                      const recebidoIntermediador = parcelasDoMes.filter(p => p.status === 'pago').reduce((sum, p) => sum + p.rendimentoIntermediador, 0) + 
                        parcelasDoMes.filter(p => p.status !== 'pago' && (p.valorRecebido || 0) > 0).reduce((sum, p) => sum + (p.rendimentoIntermediador * (p.valorRecebido || 0)) / p.valor, 0);
                      return totalIntermediador > 0 ? ((recebidoIntermediador / totalIntermediador) * 100).toFixed(1) : 0;
                    })()}%
                  </div>
                  <div className="w-24 bg-gray-200 rounded-full h-2 mt-2">
                    <div 
                      className="bg-purple-600 h-2 rounded-full transition-all duration-300" 
                      style={{ 
                        width: `${(() => {
                          const totalIntermediador = resumoMes.rendimentoIntermediador;
                          const recebidoIntermediador = parcelasDoMes.filter(p => p.status === 'pago').reduce((sum, p) => sum + p.rendimentoIntermediador, 0) + 
                            parcelasDoMes.filter(p => p.status !== 'pago' && (p.valorRecebido || 0) > 0).reduce((sum, p) => sum + (p.rendimentoIntermediador * (p.valorRecebido || 0)) / p.valor, 0);
                          return totalIntermediador > 0 ? Math.min((recebidoIntermediador / totalIntermediador) * 100, 100) : 0;
                        })()}%` 
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Reports;