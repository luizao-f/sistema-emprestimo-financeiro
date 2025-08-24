export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      emprestimos: {
        Row: {
          created_at: string | null
          data_emprestimo: string
          data_vencimento: string | null
          devedor: string
          id: string
          observacoes: string | null
          parceiro_percentual: number | null
          parceiro_rendimento: number | null
          rendimento_mensal: number | null
          seu_percentual: number | null
          seu_rendimento: number | null
          status: Database["public"]["Enums"]["loan_status"] | null
          taxa_mensal: number
          tipo_pagamento: Database["public"]["Enums"]["payment_type"]
          valor_parceiro: number
          valor_seu: number
          valor_total: number
        }
        Insert: {
          created_at?: string | null
          data_emprestimo: string
          data_vencimento?: string | null
          devedor: string
          id?: string
          observacoes?: string | null
          parceiro_percentual?: number | null
          parceiro_rendimento?: number | null
          rendimento_mensal?: number | null
          seu_percentual?: number | null
          seu_rendimento?: number | null
          status?: Database["public"]["Enums"]["loan_status"] | null
          taxa_mensal: number
          tipo_pagamento: Database["public"]["Enums"]["payment_type"]
          valor_parceiro: number
          valor_seu: number
          valor_total: number
        }
        Update: {
          created_at?: string | null
          data_emprestimo?: string
          data_vencimento?: string | null
          devedor?: string
          id?: string
          observacoes?: string | null
          parceiro_percentual?: number | null
          parceiro_rendimento?: number | null
          rendimento_mensal?: number | null
          seu_percentual?: number | null
          seu_rendimento?: number | null
          status?: Database["public"]["Enums"]["loan_status"] | null
          taxa_mensal?: number
          tipo_pagamento?: Database["public"]["Enums"]["payment_type"]
          valor_parceiro?: number
          valor_seu?: number
          valor_total?: number
        }
        Relationships: []
      }
      recebimentos: {
        Row: {
          created_at: string | null
          data_recebimento: string | null
          data_vencimento: string
          emprestimo_id: string | null
          id: string
          observacoes: string | null
          parceiro_valor: number
          seu_valor: number
          status: Database["public"]["Enums"]["payment_status"] | null
          valor_esperado: number
          valor_recebido: number | null
        }
        Insert: {
          created_at?: string | null
          data_recebimento?: string | null
          data_vencimento: string
          emprestimo_id?: string | null
          id?: string
          observacoes?: string | null
          parceiro_valor: number
          seu_valor: number
          status?: Database["public"]["Enums"]["payment_status"] | null
          valor_esperado: number
          valor_recebido?: number | null
        }
        Update: {
          created_at?: string | null
          data_recebimento?: string | null
          data_vencimento?: string
          emprestimo_id?: string | null
          id?: string
          observacoes?: string | null
          parceiro_valor?: number
          seu_valor?: number
          status?: Database["public"]["Enums"]["payment_status"] | null
          valor_esperado?: number
          valor_recebido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recebimentos_emprestimo_id_fkey"
            columns: ["emprestimo_id"]
            isOneToOne: false
            referencedRelation: "emprestimos"
            referencedColumns: ["id"]
          },
        ]
      }
      socios: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          nome: string
          participacao_padrao: number | null
          telefone: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          nome: string
          participacao_padrao?: number | null
          telefone?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          nome?: string
          participacao_padrao?: number | null
          telefone?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      update_payment_status: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      loan_status: "ativo" | "pendente" | "finalizado"
      payment_status: "pendente" | "pago" | "atrasado"
      payment_type: "mensal" | "trimestral" | "anual"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      loan_status: ["ativo", "pendente", "finalizado"],
      payment_status: ["pendente", "pago", "atrasado"],
      payment_type: ["mensal", "trimestral", "anual"],
    },
  },
} as const
