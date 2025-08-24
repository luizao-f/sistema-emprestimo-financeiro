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
  
  // NOVOS CAMPOS ADICIONADOS:
  taxa_total?: number; // Taxa total do empréstimo (ex: 3%)
  taxa_intermediador?: number; // Taxa do intermediador (ex: 1%)
  intermediador_nome?: string; // Nome do intermediador
  rendimento_total?: number; // Rendimento total mensal
  rendimento_intermediador?: number; // Rendimento do intermediador
  rendimento_investidores?: number; // Rendimento dos investidores
  emprestimo_parceiros?: EmprestimoParceiro[]; // Relação com parceiros
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
  
  // NOVO CAMPO ADICIONADO:
  valor_intermediador?: number; // Valor destinado ao intermediador
}

export interface Socio {
  id: string;
  created_at?: string;
  nome: string;
  email?: string;
  telefone?: string;
  participacao_padrao: number;
}

// NOVAS INTERFACES ADICIONADAS:

export interface EmprestimoParceiro {
  id: string;
  created_at?: string;
  emprestimo_id: string;
  nome_parceiro: string;
  valor_investido: number;
  percentual_participacao: number; // % de participação no rendimento dos investidores
  observacoes?: string;
}

export interface RecebimentoParceiro {
  id: string;
  created_at?: string;
  recebimento_id: string;
  nome_parceiro: string;
  valor_esperado: number;
  valor_recebido?: number;
  percentual_participacao: number;
}

// Interface para o formulário de novo empréstimo
export interface NovoEmprestimoForm {
  devedor: string;
  data_emprestimo: string;
  valor_total: number;
  taxa_total: number;
  taxa_intermediador?: number;
  intermediador_nome?: string;
  tipo_pagamento: PaymentType;
  data_vencimento?: string;
  observacoes?: string;
  status: LoanStatus;
  parceiros: {
    nome_parceiro: string;
    valor_investido: number;
    percentual_participacao: number;
    observacoes?: string;
  }[];
}