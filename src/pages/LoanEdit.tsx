import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft,
  Save,
  Loader2,
  Plus,
  Trash2,
  Users,
  DollarSign,
  Percent,
  Calendar
} from 'lucide-react';

interface Parceiro {
  id?: string;
  nome_parceiro: string;
  valor_investido: number;
  percentual_participacao: number;
}

interface EmprestimoData {
  id?: string;
  devedor: string;
  valor_total: number;
  taxa_mensal: number;
  taxa_total?: number;
  taxa_intermediador: number;
  intermediador_nome: string;
  rendimento_mensal: number;
  rendimento_total?: number;
  rendimento_intermediador: number;
  data_emprestimo: string;
  data_vencimento?: string;
  tipo_pagamento: string;
  status: string;
  observacoes?: string;
  valor_seu?: number;
  valor_parceiro?: number;
  seu_rendimento?: number;
  parceiro_rendimento?: number;
}

const LoanEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [emprestimo, setEmprestimo] = useState<EmprestimoData>({
    devedor: '',
    valor_total: 0,
    taxa_mensal: 0,
    taxa_intermediador: 0,
    intermediador_nome: '',
    rendimento_mensal: 0,
    rendimento_intermediador: 0,
    data_emprestimo: new Date().toISOString().split('T')[0],
    data_vencimento: '',
    tipo_pagamento: 'mensal',
    status: 'ativo',
    observacoes: ''
  });
  
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Funções de formatação
  const formatarValorMonetario = (valor: string) => {
    const apenasNumeros = valor.replace(/\D/g, '');
    if (!apenasNumeros) return 0;
    const numero = parseInt(apenasNumeros) || 0;
    const reais = numero / 100;
    return reais;
  };

  const formatarPercentual = (valor: string) => {
    const apenasNumeros = valor.replace(/\D/g, '');
    if (!apenasNumeros) return 0;
    const numero = parseInt(apenasNumeros) || 0;
    const percentual = numero / 100;
    return Math.min(percentual, 100);
  };

  const exibirValorFormatado = (valor: number) => {
    if (valor === 0) return '';
    return valor.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const exibirPercentualFormatado = (valor: number) => {
    if (valor === 0) return '';
    return valor.toFixed(2).replace('.', ',');
  };

  const loadEmprestimo = async () => {
    if (!id) return;

    try {
      setLoading(true);
      setIsEditMode(true);

      const { data: emprestimoData, error: emprestimoError } = await supabase
        .from('emprestimos')
        .select('*')
        .eq('id', id)
        .single();

      if (emprestimoError) throw emprestimoError;

      const { data: parceirosData, error: parceirosError } = await supabase
        .from('emprestimo_parceiros')
        .select('*')
        .eq('emprestimo_id', id);

      if (parceirosError) throw parceirosError;

      setEmprestimo({
        ...emprestimoData,
        data_emprestimo: emprestimoData.data_emprestimo ? 
          emprestimoData.data_emprestimo.split('T')[0] : 
          new Date().toISOString().split('T')[0],
        data_vencimento: emprestimoData.data_vencimento ? 
          emprestimoData.data_vencimento.split('T')[0] : ''
      });

      setParceiros(parceirosData || []);

    } catch (error: any) {
      toast({
        title: "Erro ao carregar empréstimo",
        description: error.message,
        variant: "destructive",
      });
      navigate('/loans');
    } finally {
      setLoading(false);
    }
  };

  const calcularRendimentos = () => {
    const taxaTotal = emprestimo.taxa_mensal || 0;
    const taxaIntermediador = emprestimo.taxa_intermediador || 0;
    const taxaInvestidores = taxaTotal - taxaIntermediador;
    
    const rendimentoTotal = (emprestimo.valor_total * taxaTotal) / 100;
    const rendimentoIntermediador = (emprestimo.valor_total * taxaIntermediador) / 100;
    const rendimentoInvestidores = rendimentoTotal - rendimentoIntermediador;

    return {
      rendimentoTotal,
      rendimentoIntermediador,
      rendimentoInvestidores,
      taxaInvestidores
    };
  };

  const adicionarParceiro = () => {
    setParceiros([...parceiros, {
      nome_parceiro: '',
      valor_investido: 0,
      percentual_participacao: 0
    }]);
  };

  const removerParceiro = (index: number) => {
    setParceiros(parceiros.filter((_, i) => i !== index));
  };

  const atualizarParceiro = (index: number, campo: keyof Parceiro, valor: any) => {
    const novosParceiros = [...parceiros];
    novosParceiros[index] = { ...novosParceiros[index], [campo]: valor };
    setParceiros(novosParceiros);
  };

  const calcularPercentuais = () => {
    const totalInvestido = parceiros.reduce((sum, p) => sum + (p.valor_investido || 0), 0);
    if (totalInvestido === 0) return;

    let somatorioPercentuais = 0;
    const novosPerceiros = parceiros.map((parceiro, index) => {
      const percentual = ((parceiro.valor_investido || 0) / totalInvestido) * 100;
      const percentualArredondado = Math.round(percentual * 100) / 100;
      
      if (index === parceiros.length - 1) {
        const percentualAjustado = Math.round((100 - somatorioPercentuais) * 100) / 100;
        return { ...parceiro, percentual_participacao: percentualAjustado };
      } else {
        somatorioPercentuais += percentualArredondado;
        return { ...parceiro, percentual_participacao: percentualArredondado };
      }
    });
    
    setParceiros(novosPerceiros);
  };

  const validarFormulario = (): boolean => {
    if (!emprestimo.devedor.trim()) {
      toast({
        title: "Erro de validação",
        description: "Nome do devedor é obrigatório",
        variant: "destructive",
      });
      return false;
    }

    if (emprestimo.valor_total <= 0) {
      toast({
        title: "Erro de validação",
        description: "Valor total deve ser maior que zero",
        variant: "destructive",
      });
      return false;
    }

    if (emprestimo.taxa_mensal <= 0) {
      toast({
        title: "Erro de validação",
        description: "Taxa mensal deve ser maior que zero",
        variant: "destructive",
      });
      return false;
    }

    const totalInvestidoParceiros = parceiros.reduce((sum, p) => sum + (p.valor_investido || 0), 0);
    if (totalInvestidoParceiros > emprestimo.valor_total) {
      toast({
        title: "Erro de validação",
        description: "Valor total dos parceiros não pode ser maior que o valor do empréstimo",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const salvarEmprestimo = async () => {
    if (!validarFormulario()) return;

    try {
      setSaving(true);
      
      const camposPermitidos = {
        devedor: emprestimo.devedor,
        valor_total: emprestimo.valor_total,
        taxa_mensal: emprestimo.taxa_mensal,
        taxa_intermediador: emprestimo.taxa_intermediador || 0,
        intermediador_nome: emprestimo.intermediador_nome || '',
        data_emprestimo: emprestimo.data_emprestimo,
        data_vencimento: emprestimo.data_vencimento || null,
        tipo_pagamento: emprestimo.tipo_pagamento || 'mensal',
        status: emprestimo.status || 'ativo',
        observacoes: emprestimo.observacoes || ''
      };

      const { error: emprestimoError } = await supabase
        .from('emprestimos')
        .update(camposPermitidos)
        .eq('id', id);

      if (emprestimoError) throw emprestimoError;

      const { error: deleteError } = await supabase
        .from('emprestimo_parceiros')
        .delete()
        .eq('emprestimo_id', id);

      if (deleteError) throw deleteError;

      if (parceiros.length > 0) {
        const parceirosParaInserir = parceiros
          .filter(p => p.nome_parceiro.trim() && p.valor_investido > 0)
          .map(p => ({
            emprestimo_id: id,
            nome_parceiro: p.nome_parceiro.trim(),
            valor_investido: p.valor_investido,
            percentual_participacao: p.percentual_participacao
          }));

        if (parceirosParaInserir.length > 0) {
          const { error: parceirosError } = await supabase
            .from('emprestimo_parceiros')
            .insert(parceirosParaInserir);

          if (parceirosError) throw parceirosError;
        }
      }

      toast({
        title: "Empréstimo atualizado",
        description: "As alterações foram salvas com sucesso!",
      });

      navigate('/loans');

    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadEmprestimo();
    }
  }, [id]);

  useEffect(() => {
    calcularPercentuais();
  }, [parceiros.map(p => p.valor_investido).join(',')]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const { rendimentoTotal, rendimentoIntermediador, rendimentoInvestidores, taxaInvestidores } = calcularRendimentos();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/loans')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {isEditMode ? 'Editar Empréstimo' : 'Novo Empréstimo'}
            </h1>
            <p className="text-muted-foreground">
              {isEditMode ? `Editando empréstimo de ${emprestimo.devedor}` : 'Cadastre um novo empréstimo'}
            </p>
          </div>
        </div>
        <Button onClick={salvarEmprestimo} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {saving ? 'Salvando...' : 'Salvar Empréstimo'}
        </Button>
      </div>

      {/* Preview de Rendimentos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-primary/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Valor Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(emprestimo.valor_total || 0)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 dark:bg-green-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Rendimento Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(rendimentoTotal)}
            </div>
            <p className="text-xs text-muted-foreground">
              {emprestimo.taxa_mensal.toFixed(2).replace('.', ',')}% a.m.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 dark:bg-purple-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Sua Parte</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {formatCurrency(rendimentoIntermediador)}
            </div>
            <p className="text-xs text-muted-foreground">
              {emprestimo.taxa_intermediador.toFixed(2).replace('.', ',')}% da taxa
            </p>
          </CardContent>
        </Card>

        <Card className="bg-orange-50 dark:bg-orange-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Investidores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(rendimentoInvestidores)}
            </div>
            <p className="text-xs text-muted-foreground">
              {taxaInvestidores.toFixed(2).replace('.', ',')}% da taxa
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dados Principais do Empréstimo */}
        <Card>
          <CardHeader>
            <CardTitle>Dados do Empréstimo</CardTitle>
            <CardDescription>Informações principais</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="devedor">Nome do Devedor *</Label>
              <Input
                id="devedor"
                value={emprestimo.devedor}
                onChange={(e) => setEmprestimo({...emprestimo, devedor: e.target.value})}
                placeholder="Digite o nome do devedor"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valor_total">Valor Total *</Label>
                <Input
                  id="valor_total"
                  type="text"
                  value={exibirValorFormatado(emprestimo.valor_total)}
                  onChange={(e) => {
                    const valorFormatado = formatarValorMonetario(e.target.value);
                    setEmprestimo({...emprestimo, valor_total: valorFormatado});
                  }}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxa_mensal">Taxa Mensal (%) *</Label>
                <Input
                  id="taxa_mensal"
                  type="text"
                  value={exibirPercentualFormatado(emprestimo.taxa_mensal)}
                  onChange={(e) => {
                    const percentualFormatado = formatarPercentual(e.target.value);
                    setEmprestimo({...emprestimo, taxa_mensal: percentualFormatado});
                  }}
                  placeholder="4,00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="data_emprestimo">Data do Empréstimo</Label>
                <Input
                  id="data_emprestimo"
                  type="date"
                  value={emprestimo.data_emprestimo}
                  onChange={(e) => setEmprestimo({...emprestimo, data_emprestimo: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data_vencimento">Data de Vencimento</Label>
                <Input
                  id="data_vencimento"
                  type="date"
                  value={emprestimo.data_vencimento || ''}
                  onChange={(e) => setEmprestimo({...emprestimo, data_vencimento: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tipo_pagamento">Tipo de Pagamento</Label>
                <Select 
                  value={emprestimo.tipo_pagamento} 
                  onValueChange={(value) => setEmprestimo({...emprestimo, tipo_pagamento: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="trimestral">Trimestral</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select 
                  value={emprestimo.status} 
                  onValueChange={(value) => setEmprestimo({...emprestimo, status: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="finalizado">Finalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={emprestimo.observacoes || ''}
                onChange={(e) => setEmprestimo({...emprestimo, observacoes: e.target.value})}
                placeholder="Observações adicionais sobre o empréstimo"
              />
            </div>
          </CardContent>
        </Card>

        {/* Intermediação */}
        <Card>
          <CardHeader>
            <CardTitle>Intermediação</CardTitle>
            <CardDescription>Configuração da sua comissão</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="intermediador_nome">Seu Nome/Empresa</Label>
              <Input
                id="intermediador_nome"
                value={emprestimo.intermediador_nome}
                onChange={(e) => setEmprestimo({...emprestimo, intermediador_nome: e.target.value})}
                placeholder="Seu nome ou empresa"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxa_intermediador">Taxa de Intermediação (%)</Label>
              <Input
                id="taxa_intermediador"
                type="text"
                value={exibirPercentualFormatado(emprestimo.taxa_intermediador)}
                onChange={(e) => {
                  const percentualFormatado = formatarPercentual(e.target.value);
                  setEmprestimo({...emprestimo, taxa_intermediador: percentualFormatado});
                }}
                placeholder="1,00"
              />
            </div>

            <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Seus Rendimentos</h4>
              <div className="text-2xl font-bold text-purple-600 mb-1">
                {formatCurrency(rendimentoIntermediador)}
              </div>
              <p className="text-sm text-muted-foreground">
                Por mês de intermediação
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Parceiros/Investidores */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Parceiros Investidores
              </CardTitle>
              <CardDescription>
                Configure os investidores e suas participações
              </CardDescription>
            </div>
            <Button onClick={adicionarParceiro} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Parceiro
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {parceiros.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                Nenhum parceiro adicionado
              </p>
              <Button onClick={adicionarParceiro} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Primeiro Parceiro
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {parceiros.map((parceiro, index) => {
                const rendimentoMensalParceiro = (parceiro.valor_investido * taxaInvestidores) / 100;
                
                return (
                  <div key={index} className="border rounded-lg p-4 bg-green-50 dark:bg-green-950/20">
                    <div className="flex items-center justify-between mb-4">
                      <Badge variant="secondary">Parceiro {index + 1}</Badge>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removerParceiro(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="space-y-2">
                        <Label>Nome do Parceiro</Label>
                        <Input
                          value={parceiro.nome_parceiro}
                          onChange={(e) => atualizarParceiro(index, 'nome_parceiro', e.target.value)}
                          placeholder="Nome do investidor"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Valor Investido</Label>
                        <Input
                          type="text"
                          value={exibirValorFormatado(parceiro.valor_investido)}
                          onChange={(e) => {
                            const valorFormatado = formatarValorMonetario(e.target.value);
                            atualizarParceiro(index, 'valor_investido', valorFormatado);
                          }}
                          placeholder="0,00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Participação (%)</Label>
                        <Input
                          type="text"
                          value={exibirPercentualFormatado(parceiro.percentual_participacao)}
                          onChange={(e) => {
                            const percentualFormatado = formatarPercentual(e.target.value);
                            atualizarParceiro(index, 'percentual_participacao', percentualFormatado);
                          }}
                          placeholder="0,00"
                        />
                      </div>
                    </div>

                    {parceiro.valor_investido > 0 && (
                      <div className="bg-white dark:bg-gray-800 rounded p-3">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Rendimento Mensal:</span>
                            <p className="font-bold text-green-600">
                              {formatCurrency(rendimentoMensalParceiro)}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Taxa Efetiva:</span>
                            <p className="font-bold text-green-600">
                              {taxaInvestidores.toFixed(2).replace('.', ',')}% a.m.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Resumo dos Parceiros */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Resumo dos Investidores</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total Investido:</span>
                    <p className="font-bold">
                      {formatCurrency(parceiros.reduce((sum, p) => sum + (p.valor_investido || 0), 0))}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Rendimento Total:</span>
                    <p className="font-bold text-green-600">
                      {formatCurrency(rendimentoInvestidores)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Taxa dos Investidores:</span>
                    <p className="font-bold">
                      {taxaInvestidores.toFixed(2).replace('.', ',')}% a.m.
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Participação:</span>
                    <p className="font-bold">
                      {parceiros.reduce((sum, p) => sum + (p.percentual_participacao || 0), 0).toFixed(2).replace('.', ',')}%
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Botões de Ação */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={() => navigate('/loans')}>
          Cancelar
        </Button>
        <Button onClick={salvarEmprestimo} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {saving ? 'Salvando...' : 'Salvar Empréstimo'}
        </Button>
      </div>
    </div>
  );
};

export default LoanEdit;