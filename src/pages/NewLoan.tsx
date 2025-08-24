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

  const formatCurrency = (value) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2
    });
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleParceiroChange = (index, field, value) => {
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

  const removeParceiro = (index) => {
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

    const newParceiros = formData.parceiros.map(parceiro => ({
      ...parceiro,
      percentual_participacao: (parceiro.valor_investido / totalInvestido) * 100
    }));

    setFormData(prev => ({ ...prev, parceiros: newParceiros }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const totalInvestido = formData.parceiros.reduce((sum, p) => sum + p.valor_investido, 0);
    const totalPercentuais = formData.parceiros.reduce((sum, p) => sum + p.percentual_participacao, 0);

    // Validações
    if (formData.valor_total <= 0) {
      toast({
        title: "Erro", description: "O valor total deve ser maior que zero.",
        variant: "destructive",
      });
      return;
    }

    if (totalInvestido !== formData.valor_total) {
      toast({
        title: "Erro", description: "A soma dos valores investidos deve ser igual ao valor total.",
        variant: "destructive",
      });
      return;
    }

    if (Math.abs(totalPercentuais - 100) > 0.01) {
      toast({
        title: "Erro", description: "A soma dos percentuais deve ser igual a 100%.",
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
    } catch (error) {
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
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do Devedor *</Label>
                <Input
                  placeholder="Ex: João Silva"
                  value={formData.devedor}
                  onChange={(e) => handleInputChange('devedor', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Data do Empréstimo *</Label>
                <Input
                  type="date"
                  value={formData.data_emprestimo}
                  onChange={(e) => handleInputChange('data_emprestimo', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Valor Total do Empréstimo *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={formData.valor_total || ''}
                  onChange={(e) => handleInputChange('valor_total', parseFloat(e.target.value) || 0)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Taxa Total (%) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Ex: 3.0"
                  value={formData.taxa_total || ''}
                  onChange={(e) => handleInputChange('taxa_total', parseFloat(e.target.value) || 0)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Taxa do Intermediador (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Ex: 1.0"
                  value={formData.taxa_intermediador || ''}
                  onChange={(e) => handleInputChange('taxa_intermediador', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Taxa dos Investidores (%)</Label>
                <Input
                  value={taxaInvestidores.toFixed(2)}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>

            {formData.taxa_intermediador > 0 && (
              <div className="space-y-2">
                <Label>Nome do Intermediador *</Label>
                <Input
                  placeholder="Nome da pessoa/empresa intermediadora"
                  value={formData.intermediador_nome}
                  onChange={(e) => handleInputChange('intermediador_nome', e.target.value)}
                  required={formData.taxa_intermediador > 0}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Parceiros */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Parceiros/Investidores</CardTitle>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={calcularPercentuaisAutomatico}>
                  <Calculator className="w-4 h-4 mr-2" />
                  Calcular %
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={addParceiro}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar
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
                    <Label>Nome *</Label>
                    <Input
                      placeholder="Nome completo"
                      value={parceiro.nome_parceiro}
                      onChange={(e) => handleParceiroChange(index, 'nome_parceiro', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor Investido *</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        value={parceiro.valor_investido || ''}
                        onChange={(e) => handleParceiroChange(index, 'valor_investido', parseFloat(e.target.value) || 0)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Participação (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      placeholder="0.00"
                      value={parceiro.percentual_participacao || ''}
                      onChange={(e) => handleParceiroChange(index, 'percentual_participacao', parseFloat(e.target.value) || 0)}
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
            
            {/* Resumo */}
            <div className="bg-muted/30 p-4 rounded-lg">
              <h4 className="font-medium mb-3">Resumo</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Total Investido</div>
                  <div className="font-semibold">{formatCurrency(totalInvestido)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Total %</div>
                  <div className="font-semibold">{totalPercentuais.toFixed(2)}%</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Status</div>
                  <div className={`font-semibold ${
                    totalInvestido === formData.valor_total && Math.abs(totalPercentuais - 100) < 0.01
                      ? 'text-success' : 'text-destructive'
                  }`}>
                    {totalInvestido === formData.valor_total && Math.abs(totalPercentuais - 100) < 0.01
                      ? '✓ OK' : '⚠ Verificar'
                    }
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resumo Financeiro */}
        {formData.valor_total > 0 && formData.taxa_total > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Resumo Financeiro</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {formatCurrency(rendimentoTotal)}
                  </div>
                  <div className="text-sm text-muted-foreground">Rendimento Total</div>
                </div>
                
                {formData.taxa_intermediador > 0 && (
                  <div className="text-center">
                    <div className="text-2xl font-bold text-warning">
                      {formatCurrency(rendimentoIntermediador)}
                    </div>
                    <div className="text-sm text-muted-foreground">Intermediador</div>
                  </div>
                )}
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-success">
                    {formatCurrency(rendimentoInvestidores)}
                  </div>
                  <div className="text-sm text-muted-foreground">Investidores</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/loans')}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={loading} className="flex-1">
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