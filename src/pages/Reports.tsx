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
  const [modalPagamento, setModalPagamento] = useState<{
    aberto: boolean;
    parcela: ParcelaCalculada | null;
  }>({ aberto: false, parcela: null });
  const [valorPagamento, setValorPagamento] = useState('');
  const { toast } = useToast();

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
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
          const rendimentoTotal = emprestimo.rendimento_total || emprestimo.rendimento_mensal || 0;
          const taxaIntermediador = emprestimo.taxa_intermediador || 0;
          const rendimentoIntermediador = (rendimentoTotal * taxaIntermediador) / 100;
          const rendimentoInvestidores = rendimentoTotal - rendimentoIntermediador;

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
            rendimentoInvestidores
          };

          // Verificar se já foi pago
          const jaRecebido = pagamentosRecebidos.find(p => 
            p.emprestimo_id === emprestimo.id && 
            isSameMonth(parseISO(p.data_pagamento), proximoPagamento)
          );

          if (jaRecebido) {
            parcela.status = 'pago';
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
    const totalRecebido = parcelasMes.filter(p => p.status === 'pago').reduce((sum, p) => sum + p.valor, 0);
    const totalPendente = totalPrevisto - totalRecebido;
    
    const rendimentoIntermediador = parcelasMes.reduce((sum, p) => sum + p.rendimentoIntermediador, 0);
    const rendimentoInvestidores = parcelasMes.reduce((sum, p) => sum + p.rendimentoInvestidores, 0);

    // Calcular por investidor
    const porInvestidor: Record<string, { previsto: number; recebido: number; pendente: number }> = {};
    
    parcelasMes.forEach(parcela => {
      if (parcela.investidores && parcela.investidores.length > 0) {
        parcela.investidores.forEach((inv: any) => {
          const nome = inv.nome_parceiro;
          const valorInvestidor = (parcela.rendimentoInvestidores * inv.percentual_participacao) / 100;
          
          if (!porInvestidor[nome]) {
            porInvestidor[nome] = { previsto: 0, recebido: 0, pendente: 0 };
          }
          
          porInvestidor[nome].previsto += valorInvestidor;
          if (parcela.status === 'pago') {
            porInvestidor[nome].recebido += valorInvestidor;
          }
          porInvestidor[nome].pendente = porInvestidor[nome].previsto - porInvestidor[nome].recebido;
        });
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

      // Carregar pagamentos recebidos
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('recebimentos')
        .select('*')
        .eq('status', 'pago');

      if (paymentsError) throw paymentsError;

      setEmprestimos(loansData || []);
      setPagamentosRecebidos(paymentsData || []);

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
      const valor = parseFloat(valorPagamento);
      const parcela = modalPagamento.parcela;

      // Inserir ou atualizar recebimento
      const { error } = await supabase
        .from('recebimentos')
        .upsert({
          emprestimo_id: parcela.emprestimoId,
          data_vencimento: parcela.dataVencimento.toISOString(),
          data_pagamento: new Date().toISOString(),
          valor_esperado: parcela.valor,
          valor_recebido: valor,
          status: 'pago',
          // Distribuir valores conforme configuração
          seu_valor: parcela.rendimentoIntermediador,
          parceiro_valor: parcela.rendimentoInvestidores
        });

      if (error) throw error;

      toast({
        title: "Pagamento registrado",
        description: `Pagamento de ${formatCurrency(valor)} registrado com sucesso.`,
      });

      setModalPagamento({ aberto: false, parcela: null });
      setValorPagamento('');
      loadData(); // Recarregar dados

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
    
    return <Badge variant={variants[status] || 'secondary'}>{status.toUpperCase()}</Badge>;
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
            
            <div className="text-center">
              <h2 className="text-2xl font-bold">
                {format(mesAtual, 'MMMM yyyy', { locale: ptBR })}
              </h2>
              <p className="text-sm text-muted-foreground">
                Baseado nas datas de cadastro dos empréstimos
              </p>
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
            <CardTitle className="text-sm font-medium">Sua Parte</CardTitle>
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
                        </div>
                      </div>

                      {/* Distribuição */}
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
                        <h5 className="font-medium text-sm text-muted-foreground mb-3">Distribuição do Rendimento:</h5>
                        
                        {/* Intermediador */}
                        <div className="flex justify-between items-center py-2 border-b">
                          <span className="text-sm">Intermediador ({parcela.taxaIntermediador}%)</span>
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
                                    {investidor.nome_parceiro} ({investidor.percentual_participacao}%)
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
                              setValorPagamento(parcela.valor.toString());
                            } else {
                              setModalPagamento({ aberto: false, parcela: null });
                              setValorPagamento('');
                            }
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button className="bg-blue-600 hover:bg-blue-700">
                              Registrar Pagamento
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
                              </div>
                              
                              <div>
                                <label className="block text-sm font-medium mb-2">
                                  Valor Recebido
                                </label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={valorPagamento}
                                  onChange={(e) => setValorPagamento(e.target.value)}
                                  placeholder="Digite o valor recebido"
                                />
                              </div>

                              <div className="flex space-x-2">
                                <Button
                                  onClick={handleRegistrarPagamento}
                                  className="flex-1 bg-green-600 hover:bg-green-700"
                                >
                                  Confirmar Recebimento
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setModalPagamento({ aberto: false, parcela: null });
                                    setValorPagamento('');
                                  }}
                                  className="flex-1"
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
                <div key={nome} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-semibold">{nome}</h4>
                    <div className="text-sm text-muted-foreground mt-1">
                      Previsto: {formatCurrency(valores.previsto)} • 
                      Recebido: {formatCurrency(valores.recebido)} • 
                      Pendente: {formatCurrency(valores.pendente)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Progresso</div>
                    <div className="font-bold text-blue-600">
                      {valores.previsto > 0 ? ((valores.recebido / valores.previsto) * 100).toFixed(1) : 0}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Reports;