-- Create enum for payment types
CREATE TYPE payment_type AS ENUM ('mensal', 'trimestral', 'anual');

-- Create enum for loan status
CREATE TYPE loan_status AS ENUM ('ativo', 'pendente', 'finalizado');

-- Create enum for payment status
CREATE TYPE payment_status AS ENUM ('pendente', 'pago', 'atrasado');

-- Create emprestimos table
CREATE TABLE emprestimos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  data_emprestimo DATE NOT NULL,
  valor_total DECIMAL(15,2) NOT NULL,
  valor_seu DECIMAL(15,2) NOT NULL,
  valor_parceiro DECIMAL(15,2) NOT NULL,
  devedor VARCHAR(255) NOT NULL,
  taxa_mensal DECIMAL(5,2) NOT NULL,
  tipo_pagamento payment_type NOT NULL,
  data_vencimento DATE,
  observacoes TEXT,
  status loan_status DEFAULT 'ativo',
  rendimento_mensal DECIMAL(15,2) GENERATED ALWAYS AS (valor_total * taxa_mensal / 100) STORED,
  seu_rendimento DECIMAL(15,2) GENERATED ALWAYS AS (valor_seu * taxa_mensal / 100) STORED,
  parceiro_rendimento DECIMAL(15,2) GENERATED ALWAYS AS (valor_parceiro * taxa_mensal / 100) STORED,
  seu_percentual DECIMAL(5,2) GENERATED ALWAYS AS (valor_seu / valor_total * 100) STORED,
  parceiro_percentual DECIMAL(5,2) GENERATED ALWAYS AS (valor_parceiro / valor_total * 100) STORED
);

-- Create recebimentos table
CREATE TABLE recebimentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  emprestimo_id UUID REFERENCES emprestimos(id) ON DELETE CASCADE,
  data_vencimento DATE NOT NULL,
  data_recebimento DATE,
  valor_esperado DECIMAL(15,2) NOT NULL,
  valor_recebido DECIMAL(15,2),
  seu_valor DECIMAL(15,2) NOT NULL,
  parceiro_valor DECIMAL(15,2) NOT NULL,
  status payment_status DEFAULT 'pendente',
  observacoes TEXT
);

-- Create socios table
CREATE TABLE socios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  telefone VARCHAR(20),
  participacao_padrao DECIMAL(5,2) DEFAULT 50.00
);

-- Enable RLS
ALTER TABLE emprestimos ENABLE ROW LEVEL SECURITY;
ALTER TABLE recebimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE socios ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for emprestimos
CREATE POLICY "Allow all operations for authenticated users" ON emprestimos
FOR ALL USING (auth.role() = 'authenticated');

-- Create RLS policies for recebimentos
CREATE POLICY "Allow all operations for authenticated users" ON recebimentos
FOR ALL USING (auth.role() = 'authenticated');

-- Create RLS policies for socios
CREATE POLICY "Allow all operations for authenticated users" ON socios
FOR ALL USING (auth.role() = 'authenticated');

-- Insert sample data
INSERT INTO emprestimos (
  data_emprestimo, valor_total, valor_seu, valor_parceiro, 
  devedor, taxa_mensal, tipo_pagamento, status
) VALUES (
  '2023-12-01', 50000.00, 35000.00, 15000.00,
  'Fernando', 1.80, 'mensal', 'ativo'
);

-- Create function to update payment status based on due date
CREATE OR REPLACE FUNCTION update_payment_status()
RETURNS void AS $$
BEGIN
  UPDATE recebimentos 
  SET status = 'atrasado' 
  WHERE data_vencimento < CURRENT_DATE 
    AND status = 'pendente' 
    AND data_recebimento IS NULL;
END;
$$ LANGUAGE plpgsql;