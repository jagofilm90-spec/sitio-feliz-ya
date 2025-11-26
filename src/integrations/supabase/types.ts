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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      clientes: {
        Row: {
          activo: boolean | null
          codigo: string
          created_at: string
          direccion: string | null
          email: string | null
          id: string
          limite_credito: number | null
          nombre: string
          razon_social: string | null
          rfc: string | null
          saldo_pendiente: number | null
          telefono: string | null
          termino_credito: Database["public"]["Enums"]["credit_term"]
          updated_at: string
          user_id: string | null
          vendedor_asignado: string | null
        }
        Insert: {
          activo?: boolean | null
          codigo: string
          created_at?: string
          direccion?: string | null
          email?: string | null
          id?: string
          limite_credito?: number | null
          nombre: string
          razon_social?: string | null
          rfc?: string | null
          saldo_pendiente?: number | null
          telefono?: string | null
          termino_credito?: Database["public"]["Enums"]["credit_term"]
          updated_at?: string
          user_id?: string | null
          vendedor_asignado?: string | null
        }
        Update: {
          activo?: boolean | null
          codigo?: string
          created_at?: string
          direccion?: string | null
          email?: string | null
          id?: string
          limite_credito?: number | null
          nombre?: string
          razon_social?: string | null
          rfc?: string | null
          saldo_pendiente?: number | null
          telefono?: string | null
          termino_credito?: Database["public"]["Enums"]["credit_term"]
          updated_at?: string
          user_id?: string | null
          vendedor_asignado?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_vendedor_asignado_fkey"
            columns: ["vendedor_asignado"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      empleados: {
        Row: {
          activo: boolean | null
          created_at: string
          direccion: string | null
          email: string | null
          fecha_ingreso: string
          id: string
          nombre_completo: string
          notas: string | null
          puesto: string
          telefono: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          activo?: boolean | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          fecha_ingreso?: string
          id?: string
          nombre_completo: string
          notas?: string | null
          puesto: string
          telefono?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          activo?: boolean | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          fecha_ingreso?: string
          id?: string
          nombre_completo?: string
          notas?: string | null
          puesto?: string
          telefono?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      empleados_documentos: {
        Row: {
          created_at: string
          empleado_id: string
          id: string
          nombre_archivo: string
          ruta_storage: string
          tipo_documento: string
        }
        Insert: {
          created_at?: string
          empleado_id: string
          id?: string
          nombre_archivo: string
          ruta_storage: string
          tipo_documento: string
        }
        Update: {
          created_at?: string
          empleado_id?: string
          id?: string
          nombre_archivo?: string
          ruta_storage?: string
          tipo_documento?: string
        }
        Relationships: [
          {
            foreignKeyName: "empleados_documentos_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
        ]
      }
      entregas: {
        Row: {
          created_at: string
          entregado: boolean | null
          fecha_entrega: string | null
          firma_recibido: string | null
          id: string
          notas: string | null
          orden_entrega: number
          pedido_id: string
          ruta_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entregado?: boolean | null
          fecha_entrega?: string | null
          firma_recibido?: string | null
          id?: string
          notas?: string | null
          orden_entrega: number
          pedido_id: string
          ruta_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entregado?: boolean | null
          fecha_entrega?: string | null
          firma_recibido?: string | null
          id?: string
          notas?: string | null
          orden_entrega?: number
          pedido_id?: string
          ruta_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entregas_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregas_ruta_id_fkey"
            columns: ["ruta_id"]
            isOneToOne: false
            referencedRelation: "rutas"
            referencedColumns: ["id"]
          },
        ]
      }
      facturas: {
        Row: {
          cliente_id: string
          created_at: string
          fecha_emision: string
          fecha_pago: string | null
          fecha_vencimiento: string | null
          folio: string
          id: string
          impuestos: number
          metodo_pago: string | null
          notas: string | null
          pagada: boolean | null
          pedido_id: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          fecha_emision?: string
          fecha_pago?: string | null
          fecha_vencimiento?: string | null
          folio: string
          id?: string
          impuestos: number
          metodo_pago?: string | null
          notas?: string | null
          pagada?: boolean | null
          pedido_id: string
          subtotal: number
          total: number
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          fecha_emision?: string
          fecha_pago?: string | null
          fecha_vencimiento?: string | null
          folio?: string
          id?: string
          impuestos?: number
          metodo_pago?: string | null
          notas?: string | null
          pagada?: boolean | null
          pedido_id?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facturas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      inventario_movimientos: {
        Row: {
          cantidad: number
          created_at: string
          fecha_caducidad: string | null
          id: string
          lote: string | null
          notas: string | null
          producto_id: string
          referencia: string | null
          tipo_movimiento: string
          usuario_id: string
        }
        Insert: {
          cantidad: number
          created_at?: string
          fecha_caducidad?: string | null
          id?: string
          lote?: string | null
          notas?: string | null
          producto_id: string
          referencia?: string | null
          tipo_movimiento: string
          usuario_id: string
        }
        Update: {
          cantidad?: number
          created_at?: string
          fecha_caducidad?: string | null
          id?: string
          lote?: string | null
          notas?: string | null
          producto_id?: string
          referencia?: string | null
          tipo_movimiento?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventario_movimientos_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventario_movimientos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          cliente_id: string
          created_at: string
          fecha_entrega_estimada: string | null
          fecha_pedido: string
          folio: string
          id: string
          impuestos: number | null
          notas: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number | null
          total: number | null
          updated_at: string
          vendedor_id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          fecha_entrega_estimada?: string | null
          fecha_pedido?: string
          folio: string
          id?: string
          impuestos?: number | null
          notas?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number | null
          total?: number | null
          updated_at?: string
          vendedor_id: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          fecha_entrega_estimada?: string | null
          fecha_pedido?: string
          folio?: string
          id?: string
          impuestos?: number | null
          notas?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number | null
          total?: number | null
          updated_at?: string
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos_detalles: {
        Row: {
          cantidad: number
          created_at: string
          id: string
          pedido_id: string
          precio_unitario: number
          producto_id: string
          subtotal: number
        }
        Insert: {
          cantidad: number
          created_at?: string
          id?: string
          pedido_id: string
          precio_unitario: number
          producto_id: string
          subtotal: number
        }
        Update: {
          cantidad?: number
          created_at?: string
          id?: string
          pedido_id?: string
          precio_unitario?: number
          producto_id?: string
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_detalles_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_detalles_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      productos: {
        Row: {
          activo: boolean | null
          codigo: string
          created_at: string
          descripcion: string | null
          id: string
          maneja_caducidad: boolean | null
          nombre: string
          precio_compra: number
          precio_venta: number
          stock_actual: number
          stock_minimo: number
          unidad: Database["public"]["Enums"]["unit_type"]
          updated_at: string
        }
        Insert: {
          activo?: boolean | null
          codigo: string
          created_at?: string
          descripcion?: string | null
          id?: string
          maneja_caducidad?: boolean | null
          nombre: string
          precio_compra?: number
          precio_venta?: number
          stock_actual?: number
          stock_minimo?: number
          unidad?: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
        }
        Update: {
          activo?: boolean | null
          codigo?: string
          created_at?: string
          descripcion?: string | null
          id?: string
          maneja_caducidad?: boolean | null
          nombre?: string
          precio_compra?: number
          precio_venta?: number
          stock_actual?: number
          stock_minimo?: number
          unidad?: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rutas: {
        Row: {
          ayudante_id: string | null
          chofer_id: string
          created_at: string
          fecha_ruta: string
          folio: string
          id: string
          notas: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          ayudante_id?: string | null
          chofer_id: string
          created_at?: string
          fecha_ruta: string
          folio: string
          id?: string
          notas?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          ayudante_id?: string | null
          chofer_id?: string
          created_at?: string
          fecha_ruta?: string
          folio?: string
          id?: string
          notas?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rutas_ayudante_id_fkey"
            columns: ["ayudante_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rutas_chofer_id_fkey"
            columns: ["chofer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_cliente_id_for_user: { Args: { user_uuid: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "vendedor"
        | "chofer"
        | "almacen"
        | "secretaria"
        | "cliente"
      credit_term: "contado" | "8_dias" | "15_dias" | "30_dias"
      order_status: "pendiente" | "en_ruta" | "entregado" | "cancelado"
      unit_type: "kg" | "pieza" | "caja" | "bulto" | "costal" | "litro"
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
      app_role: [
        "admin",
        "vendedor",
        "chofer",
        "almacen",
        "secretaria",
        "cliente",
      ],
      credit_term: ["contado", "8_dias", "15_dias", "30_dias"],
      order_status: ["pendiente", "en_ruta", "entregado", "cancelado"],
      unit_type: ["kg", "pieza", "caja", "bulto", "costal", "litro"],
    },
  },
} as const
