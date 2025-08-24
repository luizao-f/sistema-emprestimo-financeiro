import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CurrencyInput } from '@/components/CurrencyInput';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft } from 'lucide-react';
import { PaymentType, LoanStatus } from '@/types/database';

const NewLoan = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    devedor: '',
    data_emprestimo: '',
    valor_total: 0,
    valor_seu: 0,
    valor_parceiro: 0,
    taxa_mensal: 0,
    tipo_pagamento: 'mensal' as PaymentType,
    data_vencimento: '',
    observacoes: '',
    status: 'ativo' as LoanStatus,
  });

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Auto-calculate partner value when total or your value changes
    if (field === 'valor_total' || field === 'valor_seu') {
      const total = field === 'valor_total' ? value : formData.valor_total;
      const seu = field === 'valor_seu' ? value : formData.valor_seu;
      const parceiro = total - seu;
      
      if (parceiro >= 0) {
        setFormData(prev => ({
          ...prev,
          [field]: value,
          valor_parceiro: parceiro
        }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.valor_total <= 0) {
      toast({
        title: "Erro de validação",
        description: "O valor total deve ser maior que zero.",
        variant: "destructive",
      });
      return;
    }

    if (formData.valor_seu + formData.valor_parceiro !== formData.valor_total) {
      toast({
        title: "Erro de validação",
        description: "A soma dos valores individuais deve ser igual ao valor total.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('emprestimos')
        .insert([{
          devedor: formData.devedor,
          data_emprestimo: formData.data_emprestimo,
          valor_total: formData.valor_total,
          valor_seu: formData.valor_seu,
          valor_parceiro: formData.valor_parceiro,
          taxa_mensal: formData.taxa_mensal,
          tipo_pagamento: formData.tipo_pagamento,
          data_vencimento: formData.data_vencimento || null,
          observacoes: formData.observacoes || null,
          status: formData.status,
        }]);

      if (error) throw error;

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

  const seuPercentual = formData.valor_total > 0 ? (formData.valor_seu / formData.valor_total * 100) : 0;
  const parceiroPercentual = formData.valor_total > 0 ? (formData.valor_parceiro / formData.valor_total * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/loans')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Novo Empréstimo</h1>
          <p className="text-muted-foreground">Cadastre um novo empréstimo em parceria</p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Informações do Empréstimo</CardTitle>
          <CardDescription>
            Preencha os dados do empréstimo e a distribuição entre os sócios
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
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

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="valor_total">Valor Total do Empréstimo *</Label>
                <CurrencyInput
                  id="valor_total"
                  value={formData.valor_total}
                  onChange={(value) => handleInputChange('valor_total', value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="valor_seu">
                    Seu Valor ({seuPercentual.toFixed(1)}%)
                  </Label>
                  <CurrencyInput
                    id="valor_seu"
                    value={formData.valor_seu}
                    onChange={(value) => handleInputChange('valor_seu', value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="valor_parceiro">
                    Valor do Parceiro ({parceiroPercentual.toFixed(1)}%)
                  </Label>
                  <CurrencyInput
                    id="valor_parceiro"
                    value={formData.valor_parceiro}
                    onChange={(value) => handleInputChange('valor_parceiro', value)}
                    disabled
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="taxa_mensal">Taxa Mensal (%) *</Label>
                <Input
                  id="taxa_mensal"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Ex: 1.5"
                  value={formData.taxa_mensal || ''}
                  onChange={(e) => handleInputChange('taxa_mensal', parseFloat(e.target.value) || 0)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tipo_pagamento">Tipo de Pagamento *</Label>
                <Select value={formData.tipo_pagamento} onValueChange={(value: PaymentType) => handleInputChange('tipo_pagamento', value)}>
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="data_vencimento">Data de Vencimento</Label>
                <Input
                  id="data_vencimento"
                  type="date"
                  value={formData.data_vencimento}
                  onChange={(e) => handleInputChange('data_vencimento', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Select value={formData.status} onValueChange={(value: LoanStatus) => handleInputChange('status', value)}>
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
                placeholder="Observações adicionais sobre o empréstimo..."
                value={formData.observacoes}
                onChange={(e) => handleInputChange('observacoes', e.target.value)}
                rows={3}
              />
            </div>

            {/* Summary */}
            {formData.valor_total > 0 && formData.taxa_mensal > 0 && (
              <Card className="bg-muted/30">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Rendimento Mensal Total</div>
                      <div className="font-semibold text-lg">
                        R$ {((formData.valor_total * formData.taxa_mensal) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Seu Rendimento</div>
                      <div className="font-semibold text-success">
                        R$ {((formData.valor_seu * formData.taxa_mensal) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Rendimento do Parceiro</div>
                      <div className="font-semibold text-primary">
                        R$ {((formData.valor_parceiro * formData.taxa_mensal) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-4 pt-6">
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
        </CardContent>
      </Card>
    </div>
  );
};

export default NewLoan;