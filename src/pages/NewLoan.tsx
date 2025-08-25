import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Plus, Trash2, Calculator } from 'lucide-react';

const NewLoan = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    devedor: '',
    data_emprestimo: '',
    valor_total: 0,
    taxa_total: 0,
    taxa_intermediador: 0,
    intermediador_nome: '',
    tipo_pagamento: 'mensal',
    data_vencimento: '',
    observacoes: '',
    status: 'ativo',
    parceiros: [
      {
        nome_parceiro: '',
        valor_investido: 0,
        percentual_participacao: 100,
        observacoes: ''
      }
    ]
  });

  // Funções de formatação melhoradas
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatarValorMonetario = (valor: string) => {
    // Remove tudo que não for dígito
    const apenasNumeros = valor.replace(/\D/g, '');
    
    // Se estiver vazio, retorna 0
    if (!apenasNumeros) return 0;
    
    // Converte para número (centavos) e depois para reais
    const numero = parseInt(apenasNumeros) || 0;
    const reais = numero / 100;
    
    return reais;
  };

  const formatarPercentual = (valor: string) => {
    // Remove tudo que não for dígito
    const apenasNumeros = valor.replace(/\D/g, '');
    
    // Se estiver vazio, retorna 0
    if (!apenasNumeros) return 0;
    
    // Converte para número com 2 casas decimais
    const numero = parseInt(apenasNumeros) || 0;
    const percentual = numero / 100;
    
    // Limita a 100%
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

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleParceiroChange = (index: number, field: string, value: any) => {
    const newParceiros = [...formData.parceiros];
    newParceiros[index] = { ...newParceiros[index], [field]: value };
    setFormData(prev => ({ ...prev, parceiros: newParceiros }));
  };

  const addParceiro = () => {
    setFormData(prev => ({
      ...prev,
      parceiros: [...prev.parceiros, {
        nome_parceiro: '',
        valor_investido: 0,
        percentual_participacao: 0,
        observacoes: ''
      }]
    }));
  };

  const removeParceiro = (index: number) => {
    if (formData.parceiros.length === 1) {
      toast({
        title: "Erro",
        description: "É necessário ter pelo menos um parceiro/investidor.",
        variant: "destructive",
      });
      return;
    }
    setFormData(prev => ({
      ...prev,
      parceiros: prev.parceiros.filter((_, i) => i !== index)
    }));
  };

  const calcularPercentuaisAutomatico = () => {
    const totalInvestido = formData.parceiros.reduce((sum, p) => sum + p.valor_investido, 0);
    
    if (totalInvestido === 0) {
      toast({
        title: "Erro",
        description: "Informe os valores investidos antes de calcular os percentuais.",
        variant: "destructive",
      });
      return;
    }

    let somatorioPercentuais = 0;
    const newParceiros = formData.parceiros.map((parceiro, index) => {
      const percentual = (parceiro.valor_investido / totalInvestido) * 100;
      const percentualArredondado = Math.round(percentual * 100) / 100;
      
      if (index === formData.parceiros.length - 1) {
        // Para o último parceiro, ajusta para que a soma seja exatamente 100%
        const percentualAjustado = Math.round((100 - somatorioPercentuais) * 100) / 100;
        return { ...parceiro, percentual_participacao: percentualAjustado };
      } else {
        somatorioPercentuais += percentualArredondado;
        return { ...parceiro, percentual_participacao: percentualArredondado };
      }
    });

    setFormData(prev => ({ ...prev, parceiros: newParceiros }));

    toast({
      title: "Percentuais calculados",
      description: "Os percentuais foram calculados proporcionalmente aos valores investidos.",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const totalInvestido = formData.parceiros.reduce((sum, p) => sum + p.valor_investido, 0);
    const totalPercentuais = formData.parceiros.reduce((sum, p) => sum + p.percentual_participacao, 0);

    // Validações
    if (formData.valor_total <= 0) {
      toast({
        title: "Erro de validação",
        description: "O valor total deve ser maior que zero.",
        variant: "destructive",
      });
      return;
    }

    if (Math.abs(totalInvestido - formData.valor_total) > 0.01) {
      toast({
        title: "Erro de validação",
        description: "A soma dos valores investidos deve ser igual ao valor total do empréstimo.",
        variant: "destructive",
      });
      return;
    }

    if (Math.abs(totalPercentuais - 100) > 0.01) {
      toast({
        title: "Erro de validação",
        description: "A soma dos percentuais de participação deve ser igual a 100%.",
        variant: "destructive",
      });
      return;
    }

    if (formData.taxa_intermediador > 0 && !formData.intermediador_nome?.trim()) {
      toast({
        title: "Erro de validação",
        description: "Informe o nome do intermediador quando houver taxa de intermediação.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // 1. Criar o empréstimo
      const { data: emprestimo, error: emprestimoError } = await supabase
        .from('emprestimos')
        .insert([{
          devedor: formData.devedor,
          data_emprestimo: formData.data_emprestimo,
          valor_total: formData.valor_total,
          taxa_total: formData.taxa_total,
          taxa_intermediador: formData.taxa_intermediador || 0,
          intermediador_nome: formData.intermediador_nome || null,
          tipo_pagamento: formData.tipo_pagamento,
          data_vencimento: formData.data_vencimento || null,
          observacoes: formData.observacoes || null,
          status: formData.status,
          // Manter campos antigos para compatibilidade
          valor_seu: formData.parceiros[0]?.valor_investido || 0,
          valor_parceiro: totalInvestido - (formData.parceiros[0]?.valor_investido || 0),
          taxa_mensal: formData.taxa_total
        }])
        .select()
        .single();

      if (emprestimoError) throw emprestimoError;

      // 2. Criar os parceiros
      const parceirosData = formData.parceiros.map(parceiro => ({
        emprestimo_id: emprestimo.id,
        nome_parceiro: parceiro.nome_parceiro,
        valor_investido: parceiro.valor_investido,
        percentual_participacao: parceiro.percentual_participacao,
        observacoes: parceiro.observacoes || null
      }));

      const { error: parceirosError } = await supabase
        .from('emprestimo_parceiros')
        .insert(parceirosData);

      if (parceirosError) throw parceirosError;

      toast({
        title: "Empréstimo criado",
        description: "O empréstimo foi cadastrado com sucesso.",
      });

      navigate('/loans');
    } catch (error: any) {
      toast({
        title: "Erro ao criar empréstimo",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Cálculos
  const totalInvestido = formData.parceiros.reduce((sum, p) => sum + p.valor_investido, 0);
  const totalPercentuais = formData.parceiros.reduce((sum, p) => sum + p.percentual_participacao, 0);
  const taxaInvestidores = formData.taxa_total - (formData.taxa_intermediador || 0);
  const rendimentoTotal = (formData.valor_total * formData.taxa_total) / 100;
  const rendimentoIntermediador = (formData.valor_total * (formData.taxa_intermediador || 0)) / 100;
  const rendimentoInvestidores = (formData.valor_total * taxaInvestidores) / 100;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/loans')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Novo Empréstimo</h1>
          <p className="text-muted-foreground">Cadastre um novo empréstimo com múltiplos parceiros</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informações Básicas */}
        <Card>
          <CardHeader>
            <CardTitle>Informações Básicas</CardTitle>
            <CardDescription>Dados gerais do empréstimo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="devedor">Nome do Devedor *</Label>
                <Input
                  id="devedor"
                  placeholder="Ex: João Silva"
                  value={formData.devedor}
                  onChange={(e) => handleInputChange('devedor', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data_emprestimo">Data do Empréstimo *</Label>
                <Input
                  id="data_emprestimo"
                  type="date"
                  value={formData.data_emprestimo}
                  onChange={(e) => handleInputChange('data_emprestimo', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="valor_total">Valor Total do Empréstimo *</Label>
              <Input
                id="valor_total"
                type="text"
                placeholder="0,00"
                value={exibirValorFormatado(formData.valor_total)}
                onChange={(e) => {
                  const valorFormatado = formatarValorMonetario(e.target.value);
                  handleInputChange('valor_total', valorFormatado);
                }}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="taxa_total">Taxa Total (%) *</Label>
                <Input
                  id="taxa_total"
                  type="text"
                  placeholder="3,00"
                  value={exibirPercentualFormatado(formData.taxa_total)}
                  onChange={(e) => {
                    const percentualFormatado = formatarPercentual(e.target.value);
                    handleInputChange('taxa_total', percentualFormatado);
                  }}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxa_intermediador">Taxa do Intermediador (%)</Label>
                <Input
                  id="taxa_intermediador"
                  type="text"
                  placeholder="1,00"
                  value={exibirPercentualFormatado(formData.taxa_intermediador)}
                  onChange={(e) => {
                    const percentualFormatado = formatarPercentual(e.target.value);
                    handleInputChange('taxa_intermediador', percentualFormatado);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxa_investidores">Taxa dos Investidores (%)</Label>
                <Input
                  id="taxa_investidores"
                  value={taxaInvestidores.toFixed(2).replace('.', ',')}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>

            {formData.taxa_intermediador > 0 && (
              <div className="space-y-2">
                <Label htmlFor="intermediador_nome">Nome do Intermediador *</Label>
                <Input
                  id="intermediador_nome"
                  placeholder="Nome da pessoa/empresa intermediadora"
                  value={formData.intermediador_nome}
                  onChange={(e) => handleInputChange('intermediador_nome', e.target.value)}
                  required={formData.taxa_intermediador > 0}
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tipo_pagamento">Tipo de Pagamento *</Label>
                <Select value={formData.tipo_pagamento} onValueChange={(value) => handleInputChange('tipo_pagamento', value)}>
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
                <Label htmlFor="status">Status *</Label>
                <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
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
              <Label htmlFor="data_vencimento">Data de Vencimento</Label>
              <Input
                id="data_vencimento"
                type="date"
                value={formData.data_vencimento}
                onChange={(e) => handleInputChange('data_vencimento', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Parceiros/Investidores */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Parceiros/Investidores</CardTitle>
                <CardDescription>Configure os investidores e suas participações</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={calcularPercentuaisAutomatico}>
                  <Calculator className="w-4 h-4 mr-2" />
                  Calcular %
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={addParceiro}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Parceiro
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.parceiros.map((parceiro, index) => (
              <div key={index} className="p-4 border rounded-lg space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium">Parceiro #{index + 1}</h4>
                  {formData.parceiros.length > 1 && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeParceiro(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Nome do Parceiro *</Label>
                    <Input
                      placeholder="Nome completo"
                      value={parceiro.nome_parceiro}
                      onChange={(e) => handleParceiroChange(index, 'nome_parceiro', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor Investido *</Label>
                    <Input
                      type="text"
                      placeholder="0,00"
                      value={exibirValorFormatado(parceiro.valor_investido)}
                      onChange={(e) => {
                        const valorFormatado = formatarValorMonetario(e.target.value);
                        handleParceiroChange(index, 'valor_investido', valorFormatado);
                      }}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Participação (%)</Label>
                    <Input
                      type="text"
                      placeholder="0,00"
                      value={exibirPercentualFormatado(parceiro.percentual_participacao)}
                      onChange={(e) => {
                        const percentualFormatado = formatarPercentual(e.target.value);
                        handleParceiroChange(index, 'percentual_participacao', percentualFormatado);
                      }}
                      required
                    />
                  </div>
                </div>

                {formData.valor_total > 0 && taxaInvestidores > 0 && parceiro.valor_investido > 0 && (
                  <div className="text-sm text-success bg-muted/30 p-3 rounded">
                    Rendimento mensal: {formatCurrency((parceiro.valor_investido * taxaInvestidores) / 100)}
                  </div>
                )}
              </div>
            ))}
            
            {/* Resumo Detalhado */}
            <div className="bg-muted/30 p-4 rounded-lg space-y-4">
              <h4 className="font-medium text-lg">Resumo Financeiro</h4>
              
              {/* Resumo Geral */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm border-b pb-4">
                <div>
                  <div className="text-muted-foreground">Total Investido</div>
                  <div className="font-semibold text-lg">{formatCurrency(totalInvestido)}</div>
                  <div className="text-xs text-muted-foreground">Meta: {formatCurrency(formData.valor_total)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Total Participação</div>
                  <div className="font-semibold text-lg">{totalPercentuais.toFixed(2).replace('.', ',')}%</div>
                  <div className="text-xs text-muted-foreground">Meta: 100%</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Rendimento Total</div>
                  <div className="font-semibold text-lg text-primary">
                    {formData.taxa_total > 0 ? formatCurrency(rendimentoTotal) : 'R$ 0,00'}
                  </div>
                  <div className="text-xs text-muted-foreground">{formData.taxa_total.toFixed(2).replace('.', ',')}% a.m.</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Status</div>
                  <div className={`font-semibold text-lg ${
                    Math.abs(totalInvestido - formData.valor_total) < 0.01 && Math.abs(totalPercentuais - 100) < 0.01
                      ? 'text-success' : 'text-destructive'
                  }`}>
                    {Math.abs(totalInvestido - formData.valor_total) < 0.01 && Math.abs(totalPercentuais - 100) < 0.01
                      ? '✓ OK' : '⚠ Verificar'
                    }
                  </div>
                </div>
              </div>

              {/* Rendimento do Intermediador */}
              {formData.taxa_intermediador > 0 && formData.intermediador_nome && (
                <div className="bg-warning/10 border border-warning/20 p-3 rounded">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium text-yellow-800 dark:text-yellow-200">
                        {formData.intermediador_nome} (Intermediador)
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Taxa: {formData.taxa_intermediador.toFixed(2).replace('.', ',')}% do valor total
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg text-warning">
                        {formatCurrency(rendimentoIntermediador)}
                      </div>
                      <div className="text-xs text-muted-foreground">por mês</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Rendimento por Parceiro */}
              {formData.parceiros.length > 0 && formData.valor_total > 0 && taxaInvestidores > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h5 className="font-medium">Rendimento dos Investidores ({taxaInvestidores.toFixed(2).replace('.', ',')}%)</h5>
                    <div className="text-sm font-semibold text-success">
                      Total: {formatCurrency(rendimentoInvestidores)}
                    </div>
                  </div>
                  
                  {formData.parceiros.map((parceiro, index) => {
                    const rendimentoParceiro = (parceiro.valor_investido * taxaInvestidores) / 100;
                    const participacaoReal = parceiro.valor_investido > 0 ? (parceiro.valor_investido / totalInvestido) * 100 : 0;
                    
                    return (
                      <div key={index} className="bg-success/10 border border-success/20 p-3 rounded">
                        <div className="flex justify-between items-center">
                          <div className="flex-1">
                           <div className="font-medium text-green-800 dark:text-green-200">
                              {parceiro.nome_parceiro || `Parceiro #${index + 1}`}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Investiu: {formatCurrency(parceiro.valor_investido)} 
                              ({participacaoReal.toFixed(1)}% do total)
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Participação nos lucros: {parceiro.percentual_participacao.toFixed(2).replace('.', ',')}%
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-lg text-success">
                              {rendimentoParceiro > 0 ? formatCurrency(rendimentoParceiro) : 'R$ 0,00'}
                            </div>
                            <div className="text-xs text-muted-foreground">por mês</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Avisos de Validação */}
              {Math.abs(totalInvestido - formData.valor_total) > 0.01 && formData.valor_total > 0 && (
                <div className="bg-destructive/10 border border-destructive/20 p-3 rounded">
                  <div className="text-sm text-destructive font-medium">
                    ⚠️ A soma dos valores investidos ({formatCurrency(totalInvestido)}) 
                    deve ser igual ao valor total ({formatCurrency(formData.valor_total)})
                  </div>
                </div>
              )}

              {Math.abs(totalPercentuais - 100) > 0.01 && (
                <div className="bg-destructive/10 border border-destructive/20 p-3 rounded">
                  <div className="text-sm text-destructive font-medium">
                    ⚠️ A soma dos percentuais de participação ({totalPercentuais.toFixed(2).replace('.', ',')}%) 
                    deve ser igual a 100%
                  </div>
                </div>
              )}

              {/* Exemplo de Cálculo */}
              {formData.valor_total > 0 && formData.taxa_total > 0 && (
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-3 rounded">
                  <div className="text-sm">
                    <div className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                      Como funciona o cálculo:
                    </div>
                    <div className="text-blue-800 dark:text-blue-200 space-y-1">
                      <div>• Valor emprestado: {formatCurrency(formData.valor_total)}</div>
                      <div>• Taxa total: {formData.taxa_total.toFixed(2).replace('.', ',')}% = {formatCurrency(rendimentoTotal)}/mês</div>
                      {formData.taxa_intermediador > 0 && (
                        <div>• Intermediador: {formData.taxa_intermediador.toFixed(2).replace('.', ',')}% = {formatCurrency(rendimentoIntermediador)}/mês</div>
                      )}
                      <div>• Para investidores: {taxaInvestidores.toFixed(2).replace('.', ',')}% = {formatCurrency(rendimentoInvestidores)}/mês</div>
                      <div className="text-xs opacity-75 mt-2">
                        * Cada parceiro recebe conforme sua participação nos lucros dos investidores
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Observações */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                placeholder="Observações adicionais sobre o empréstimo..."
                value={formData.observacoes}
                onChange={(e) => handleInputChange('observacoes', e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Botões */}
        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/loans')}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="flex-1"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Criar Empréstimo'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default NewLoan;