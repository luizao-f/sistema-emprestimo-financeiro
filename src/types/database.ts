export type PaymentType = 'mensal' | 'trimestral' | 'anual';
export type LoanStatus = 'ativo' | 'pendente' | 'finalizado';
export type PaymentStatus = 'pendente' | 'pago' | 'atrasado';

export interface Emprestimo {
  id: string;
  created_at?: string;
  data_emprestimo: string;
  valor_total: number;
  valor_seu: number;
  valor_parceiro: number;
  devedor: string;
  taxa_mensal: number;
  tipo_pagamento: PaymentType;
  data_vencimento?: string;
  observacoes?: string;
  status: LoanStatus;
  rendimento_mensal?: number;
  seu_rendimento?: number;
  parceiro_rendimento?: number;
  seu_percentual?: number;
  parceiro_percentual?: number;
}

export interface Recebimento {
  id: string;
  created_at?: string;
  emprestimo_id: string;
  data_vencimento: string;
  data_recebimento?: string;
  valor_esperado: number;
  valor_recebido?: number;
  seu_valor: number;
  parceiro_valor: number;
  status: PaymentStatus;
  observacoes?: string;
  emprestimo?: Emprestimo;
}

export interface Socio {
  id: string;
  created_at?: string;
  nome: string;
  email?: string;
  telefone?: string;
  participacao_padrao: number;
}