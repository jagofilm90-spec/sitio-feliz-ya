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
      bodegas: {
        Row: {
          activo: boolean
          costo_por_kilo: number | null
          created_at: string
          direccion: string | null
          es_externa: boolean
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          costo_por_kilo?: number | null
          created_at?: string
          direccion?: string | null
          es_externa?: boolean
          id?: string
          nombre: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          costo_por_kilo?: number | null
          created_at?: string
          direccion?: string | null
          es_externa?: boolean
          id?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      cliente_sucursales: {
        Row: {
          activo: boolean
          cliente_id: string
          codigo_sucursal: string | null
          contacto: string | null
          created_at: string
          dias_sin_entrega: string | null
          direccion: string
          direccion_fiscal: string | null
          email_facturacion: string | null
          horario_entrega: string | null
          id: string
          no_combinar_pedidos: boolean | null
          nombre: string
          notas: string | null
          razon_social: string | null
          restricciones_vehiculo: string | null
          rfc: string | null
          telefono: string | null
          updated_at: string
          zona_id: string | null
        }
        Insert: {
          activo?: boolean
          cliente_id: string
          codigo_sucursal?: string | null
          contacto?: string | null
          created_at?: string
          dias_sin_entrega?: string | null
          direccion: string
          direccion_fiscal?: string | null
          email_facturacion?: string | null
          horario_entrega?: string | null
          id?: string
          no_combinar_pedidos?: boolean | null
          nombre: string
          notas?: string | null
          razon_social?: string | null
          restricciones_vehiculo?: string | null
          rfc?: string | null
          telefono?: string | null
          updated_at?: string
          zona_id?: string | null
        }
        Update: {
          activo?: boolean
          cliente_id?: string
          codigo_sucursal?: string | null
          contacto?: string | null
          created_at?: string
          dias_sin_entrega?: string | null
          direccion?: string
          direccion_fiscal?: string | null
          email_facturacion?: string | null
          horario_entrega?: string | null
          id?: string
          no_combinar_pedidos?: boolean | null
          nombre?: string
          notas?: string | null
          razon_social?: string | null
          restricciones_vehiculo?: string | null
          rfc?: string | null
          telefono?: string | null
          updated_at?: string
          zona_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_sucursales_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_sucursales_zona_id_fkey"
            columns: ["zona_id"]
            isOneToOne: false
            referencedRelation: "zonas"
            referencedColumns: ["id"]
          },
        ]
      }
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
          preferencia_facturacion: Database["public"]["Enums"]["preferencia_facturacion"]
          razon_social: string | null
          rfc: string | null
          saldo_pendiente: number | null
          telefono: string | null
          termino_credito: Database["public"]["Enums"]["credit_term"]
          updated_at: string
          user_id: string | null
          vendedor_asignado: string | null
          zona_id: string | null
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
          preferencia_facturacion?: Database["public"]["Enums"]["preferencia_facturacion"]
          razon_social?: string | null
          rfc?: string | null
          saldo_pendiente?: number | null
          telefono?: string | null
          termino_credito?: Database["public"]["Enums"]["credit_term"]
          updated_at?: string
          user_id?: string | null
          vendedor_asignado?: string | null
          zona_id?: string | null
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
          preferencia_facturacion?: Database["public"]["Enums"]["preferencia_facturacion"]
          razon_social?: string | null
          rfc?: string | null
          saldo_pendiente?: number | null
          telefono?: string | null
          termino_credito?: Database["public"]["Enums"]["credit_term"]
          updated_at?: string
          user_id?: string | null
          vendedor_asignado?: string | null
          zona_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_vendedor_asignado_fkey"
            columns: ["vendedor_asignado"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_zona_id_fkey"
            columns: ["zona_id"]
            isOneToOne: false
            referencedRelation: "zonas"
            referencedColumns: ["id"]
          },
        ]
      }
      conversacion_participantes: {
        Row: {
          conversacion_id: string
          created_at: string | null
          id: string
          ultimo_mensaje_leido_id: string | null
          user_id: string
        }
        Insert: {
          conversacion_id: string
          created_at?: string | null
          id?: string
          ultimo_mensaje_leido_id?: string | null
          user_id: string
        }
        Update: {
          conversacion_id?: string
          created_at?: string | null
          id?: string
          ultimo_mensaje_leido_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversacion_participantes_conversacion_id_fkey"
            columns: ["conversacion_id"]
            isOneToOne: false
            referencedRelation: "conversaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      conversaciones: {
        Row: {
          creado_por: string | null
          created_at: string | null
          id: string
          nombre: string | null
          puesto: string | null
          tipo: Database["public"]["Enums"]["conversation_type"]
          updated_at: string | null
        }
        Insert: {
          creado_por?: string | null
          created_at?: string | null
          id?: string
          nombre?: string | null
          puesto?: string | null
          tipo: Database["public"]["Enums"]["conversation_type"]
          updated_at?: string | null
        }
        Update: {
          creado_por?: string | null
          created_at?: string | null
          id?: string
          nombre?: string | null
          puesto?: string | null
          tipo?: Database["public"]["Enums"]["conversation_type"]
          updated_at?: string | null
        }
        Relationships: []
      }
      cotizaciones: {
        Row: {
          cliente_id: string
          creado_por: string
          created_at: string
          email_origen_id: string | null
          fecha_creacion: string
          fecha_vigencia: string
          folio: string
          gmail_cuenta_id: string | null
          id: string
          impuestos: number
          notas: string | null
          pedido_id: string | null
          status: string
          subtotal: number
          sucursal_id: string | null
          total: number
          updated_at: string
        }
        Insert: {
          cliente_id: string
          creado_por: string
          created_at?: string
          email_origen_id?: string | null
          fecha_creacion?: string
          fecha_vigencia: string
          folio: string
          gmail_cuenta_id?: string | null
          id?: string
          impuestos?: number
          notas?: string | null
          pedido_id?: string | null
          status?: string
          subtotal?: number
          sucursal_id?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          creado_por?: string
          created_at?: string
          email_origen_id?: string | null
          fecha_creacion?: string
          fecha_vigencia?: string
          folio?: string
          gmail_cuenta_id?: string | null
          id?: string
          impuestos?: number
          notas?: string | null
          pedido_id?: string | null
          status?: string
          subtotal?: number
          sucursal_id?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cotizaciones_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizaciones_gmail_cuenta_id_fkey"
            columns: ["gmail_cuenta_id"]
            isOneToOne: false
            referencedRelation: "gmail_cuentas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizaciones_gmail_cuenta_id_fkey"
            columns: ["gmail_cuenta_id"]
            isOneToOne: false
            referencedRelation: "gmail_cuentas_segura"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizaciones_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizaciones_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "cliente_sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      cotizaciones_detalles: {
        Row: {
          cantidad: number
          cotizacion_id: string
          created_at: string
          id: string
          precio_unitario: number
          producto_id: string
          subtotal: number
        }
        Insert: {
          cantidad: number
          cotizacion_id: string
          created_at?: string
          id?: string
          precio_unitario: number
          producto_id: string
          subtotal: number
        }
        Update: {
          cantidad?: number
          cotizacion_id?: string
          created_at?: string
          id?: string
          precio_unitario?: number
          producto_id?: string
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "cotizaciones_detalles_cotizacion_id_fkey"
            columns: ["cotizacion_id"]
            isOneToOne: false
            referencedRelation: "cotizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizaciones_detalles_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      empleados: {
        Row: {
          activo: boolean | null
          clabe_interbancaria: string | null
          contacto_emergencia_nombre: string | null
          contacto_emergencia_telefono: string | null
          created_at: string
          cuenta_bancaria: string | null
          curp: string | null
          direccion: string | null
          email: string | null
          estado_civil: string | null
          fecha_baja: string | null
          fecha_ingreso: string
          fecha_nacimiento: string | null
          id: string
          motivo_baja: string | null
          nivel_estudios: string | null
          nombre: string | null
          nombre_completo: string
          notas: string | null
          numero_dependientes: number | null
          numero_seguro_social: string | null
          periodo_pago: string | null
          primer_apellido: string | null
          puesto: string
          rfc: string | null
          segundo_apellido: string | null
          sueldo_bruto: number | null
          telefono: string | null
          tipo_sangre: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          activo?: boolean | null
          clabe_interbancaria?: string | null
          contacto_emergencia_nombre?: string | null
          contacto_emergencia_telefono?: string | null
          created_at?: string
          cuenta_bancaria?: string | null
          curp?: string | null
          direccion?: string | null
          email?: string | null
          estado_civil?: string | null
          fecha_baja?: string | null
          fecha_ingreso?: string
          fecha_nacimiento?: string | null
          id?: string
          motivo_baja?: string | null
          nivel_estudios?: string | null
          nombre?: string | null
          nombre_completo: string
          notas?: string | null
          numero_dependientes?: number | null
          numero_seguro_social?: string | null
          periodo_pago?: string | null
          primer_apellido?: string | null
          puesto: string
          rfc?: string | null
          segundo_apellido?: string | null
          sueldo_bruto?: number | null
          telefono?: string | null
          tipo_sangre?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          activo?: boolean | null
          clabe_interbancaria?: string | null
          contacto_emergencia_nombre?: string | null
          contacto_emergencia_telefono?: string | null
          created_at?: string
          cuenta_bancaria?: string | null
          curp?: string | null
          direccion?: string | null
          email?: string | null
          estado_civil?: string | null
          fecha_baja?: string | null
          fecha_ingreso?: string
          fecha_nacimiento?: string | null
          id?: string
          motivo_baja?: string | null
          nivel_estudios?: string | null
          nombre?: string | null
          nombre_completo?: string
          notas?: string | null
          numero_dependientes?: number | null
          numero_seguro_social?: string | null
          periodo_pago?: string | null
          primer_apellido?: string | null
          puesto?: string
          rfc?: string | null
          segundo_apellido?: string | null
          sueldo_bruto?: number | null
          telefono?: string | null
          tipo_sangre?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      empleados_documentos: {
        Row: {
          created_at: string
          empleado_id: string
          fecha_vencimiento: string | null
          id: string
          nombre_archivo: string
          ruta_storage: string
          tipo_documento: string
        }
        Insert: {
          created_at?: string
          empleado_id: string
          fecha_vencimiento?: string | null
          id?: string
          nombre_archivo: string
          ruta_storage: string
          tipo_documento: string
        }
        Update: {
          created_at?: string
          empleado_id?: string
          fecha_vencimiento?: string | null
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
          {
            foreignKeyName: "empleados_documentos_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados_vista_segura"
            referencedColumns: ["id"]
          },
        ]
      }
      empleados_documentos_pendientes: {
        Row: {
          created_at: string
          empleado_id: string
          id: string
          notas: string | null
          tipo_documento: string
        }
        Insert: {
          created_at?: string
          empleado_id: string
          id?: string
          notas?: string | null
          tipo_documento: string
        }
        Update: {
          created_at?: string
          empleado_id?: string
          id?: string
          notas?: string | null
          tipo_documento?: string
        }
        Relationships: [
          {
            foreignKeyName: "empleados_documentos_pendientes_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empleados_documentos_pendientes_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados_vista_segura"
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
      gmail_auditoria: {
        Row: {
          accion: string
          created_at: string
          email_subject: string | null
          email_to: string | null
          gmail_cuenta_id: string
          gmail_message_id: string | null
          id: string
          user_id: string
        }
        Insert: {
          accion: string
          created_at?: string
          email_subject?: string | null
          email_to?: string | null
          gmail_cuenta_id: string
          gmail_message_id?: string | null
          id?: string
          user_id: string
        }
        Update: {
          accion?: string
          created_at?: string
          email_subject?: string | null
          email_to?: string | null
          gmail_cuenta_id?: string
          gmail_message_id?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gmail_auditoria_gmail_cuenta_id_fkey"
            columns: ["gmail_cuenta_id"]
            isOneToOne: false
            referencedRelation: "gmail_cuentas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gmail_auditoria_gmail_cuenta_id_fkey"
            columns: ["gmail_cuenta_id"]
            isOneToOne: false
            referencedRelation: "gmail_cuentas_segura"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gmail_auditoria_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gmail_cuenta_permisos: {
        Row: {
          asignado_por: string | null
          created_at: string
          gmail_cuenta_id: string
          id: string
          user_id: string
        }
        Insert: {
          asignado_por?: string | null
          created_at?: string
          gmail_cuenta_id: string
          id?: string
          user_id: string
        }
        Update: {
          asignado_por?: string | null
          created_at?: string
          gmail_cuenta_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gmail_cuenta_permisos_asignado_por_fkey"
            columns: ["asignado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gmail_cuenta_permisos_gmail_cuenta_id_fkey"
            columns: ["gmail_cuenta_id"]
            isOneToOne: false
            referencedRelation: "gmail_cuentas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gmail_cuenta_permisos_gmail_cuenta_id_fkey"
            columns: ["gmail_cuenta_id"]
            isOneToOne: false
            referencedRelation: "gmail_cuentas_segura"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gmail_cuenta_permisos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gmail_cuentas: {
        Row: {
          access_token: string | null
          activo: boolean | null
          created_at: string
          email: string
          id: string
          nombre: string
          proposito: string
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          activo?: boolean | null
          created_at?: string
          email: string
          id?: string
          nombre: string
          proposito: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          activo?: boolean | null
          created_at?: string
          email?: string
          id?: string
          nombre?: string
          proposito?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      gmail_firmas: {
        Row: {
          activo: boolean | null
          created_at: string
          firma_html: string
          gmail_cuenta_id: string
          id: string
          updated_at: string
        }
        Insert: {
          activo?: boolean | null
          created_at?: string
          firma_html?: string
          gmail_cuenta_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          activo?: boolean | null
          created_at?: string
          firma_html?: string
          gmail_cuenta_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gmail_firmas_gmail_cuenta_id_fkey"
            columns: ["gmail_cuenta_id"]
            isOneToOne: true
            referencedRelation: "gmail_cuentas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gmail_firmas_gmail_cuenta_id_fkey"
            columns: ["gmail_cuenta_id"]
            isOneToOne: true
            referencedRelation: "gmail_cuentas_segura"
            referencedColumns: ["id"]
          },
        ]
      }
      inventario_lotes: {
        Row: {
          bodega_id: string | null
          cantidad_disponible: number
          created_at: string
          fecha_caducidad: string | null
          fecha_entrada: string
          fecha_ultima_fumigacion: string | null
          id: string
          lote_referencia: string | null
          notas: string | null
          orden_compra_id: string | null
          precio_compra: number
          producto_id: string
          updated_at: string
        }
        Insert: {
          bodega_id?: string | null
          cantidad_disponible?: number
          created_at?: string
          fecha_caducidad?: string | null
          fecha_entrada?: string
          fecha_ultima_fumigacion?: string | null
          id?: string
          lote_referencia?: string | null
          notas?: string | null
          orden_compra_id?: string | null
          precio_compra: number
          producto_id: string
          updated_at?: string
        }
        Update: {
          bodega_id?: string | null
          cantidad_disponible?: number
          created_at?: string
          fecha_caducidad?: string | null
          fecha_entrada?: string
          fecha_ultima_fumigacion?: string | null
          id?: string
          lote_referencia?: string | null
          notas?: string | null
          orden_compra_id?: string | null
          precio_compra?: number
          producto_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventario_lotes_bodega_id_fkey"
            columns: ["bodega_id"]
            isOneToOne: false
            referencedRelation: "bodegas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventario_lotes_orden_compra_id_fkey"
            columns: ["orden_compra_id"]
            isOneToOne: false
            referencedRelation: "ordenes_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventario_lotes_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      inventario_movimientos: {
        Row: {
          bodega_destino_id: string | null
          bodega_origen_id: string | null
          cantidad: number
          cliente_destino_id: string | null
          created_at: string
          fecha_caducidad: string | null
          id: string
          lote: string | null
          notas: string | null
          producto_id: string
          referencia: string | null
          stock_anterior: number | null
          stock_nuevo: number | null
          tipo_movimiento: string
          usuario_id: string
        }
        Insert: {
          bodega_destino_id?: string | null
          bodega_origen_id?: string | null
          cantidad: number
          cliente_destino_id?: string | null
          created_at?: string
          fecha_caducidad?: string | null
          id?: string
          lote?: string | null
          notas?: string | null
          producto_id: string
          referencia?: string | null
          stock_anterior?: number | null
          stock_nuevo?: number | null
          tipo_movimiento: string
          usuario_id: string
        }
        Update: {
          bodega_destino_id?: string | null
          bodega_origen_id?: string | null
          cantidad?: number
          cliente_destino_id?: string | null
          created_at?: string
          fecha_caducidad?: string | null
          id?: string
          lote?: string | null
          notas?: string | null
          producto_id?: string
          referencia?: string | null
          stock_anterior?: number | null
          stock_nuevo?: number | null
          tipo_movimiento?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventario_movimientos_bodega_destino_id_fkey"
            columns: ["bodega_destino_id"]
            isOneToOne: false
            referencedRelation: "bodegas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventario_movimientos_bodega_origen_id_fkey"
            columns: ["bodega_origen_id"]
            isOneToOne: false
            referencedRelation: "bodegas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventario_movimientos_cliente_destino_id_fkey"
            columns: ["cliente_destino_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
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
      mensajes: {
        Row: {
          archivo_nombre: string | null
          archivo_tipo: string | null
          archivo_url: string | null
          contenido: string
          conversacion_id: string
          created_at: string | null
          id: string
          remitente_id: string | null
        }
        Insert: {
          archivo_nombre?: string | null
          archivo_tipo?: string | null
          archivo_url?: string | null
          contenido: string
          conversacion_id: string
          created_at?: string | null
          id?: string
          remitente_id?: string | null
        }
        Update: {
          archivo_nombre?: string | null
          archivo_tipo?: string | null
          archivo_url?: string | null
          contenido?: string
          conversacion_id?: string
          created_at?: string | null
          id?: string
          remitente_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mensajes_conversacion_id_fkey"
            columns: ["conversacion_id"]
            isOneToOne: false
            referencedRelation: "conversaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      notificaciones: {
        Row: {
          created_at: string
          descripcion: string
          documento_id: string | null
          empleado_id: string | null
          fecha_vencimiento: string | null
          id: string
          leida: boolean | null
          orden_compra_id: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          created_at?: string
          descripcion: string
          documento_id?: string | null
          empleado_id?: string | null
          fecha_vencimiento?: string | null
          id?: string
          leida?: boolean | null
          orden_compra_id?: string | null
          tipo: string
          titulo: string
        }
        Update: {
          created_at?: string
          descripcion?: string
          documento_id?: string | null
          empleado_id?: string | null
          fecha_vencimiento?: string | null
          id?: string
          leida?: boolean | null
          orden_compra_id?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificaciones_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "empleados_documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados_vista_segura"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_orden_compra_id_fkey"
            columns: ["orden_compra_id"]
            isOneToOne: false
            referencedRelation: "ordenes_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      ordenes_compra: {
        Row: {
          autorizado_por: string | null
          creado_por: string
          created_at: string
          email_enviado_en: string | null
          email_leido_en: string | null
          entregas_multiples: boolean | null
          fecha_autorizacion: string | null
          fecha_entrega_programada: string | null
          fecha_entrega_real: string | null
          fecha_orden: string
          fecha_rechazo: string | null
          folio: string
          id: string
          impuestos: number
          motivo_devolucion: string | null
          motivo_rechazo: string | null
          notas: string | null
          proveedor_id: string
          rechazado_por: string | null
          status: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          autorizado_por?: string | null
          creado_por: string
          created_at?: string
          email_enviado_en?: string | null
          email_leido_en?: string | null
          entregas_multiples?: boolean | null
          fecha_autorizacion?: string | null
          fecha_entrega_programada?: string | null
          fecha_entrega_real?: string | null
          fecha_orden?: string
          fecha_rechazo?: string | null
          folio: string
          id?: string
          impuestos?: number
          motivo_devolucion?: string | null
          motivo_rechazo?: string | null
          notas?: string | null
          proveedor_id: string
          rechazado_por?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          autorizado_por?: string | null
          creado_por?: string
          created_at?: string
          email_enviado_en?: string | null
          email_leido_en?: string | null
          entregas_multiples?: boolean | null
          fecha_autorizacion?: string | null
          fecha_entrega_programada?: string | null
          fecha_entrega_real?: string | null
          fecha_orden?: string
          fecha_rechazo?: string | null
          folio?: string
          id?: string
          impuestos?: number
          motivo_devolucion?: string | null
          motivo_rechazo?: string | null
          notas?: string | null
          proveedor_id?: string
          rechazado_por?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordenes_compra_autorizado_por_fkey"
            columns: ["autorizado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordenes_compra_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordenes_compra_rechazado_por_fkey"
            columns: ["rechazado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ordenes_compra_confirmaciones: {
        Row: {
          confirmado_en: string | null
          created_at: string
          id: string
          ip_address: string | null
          orden_compra_id: string
          user_agent: string | null
        }
        Insert: {
          confirmado_en?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          orden_compra_id: string
          user_agent?: string | null
        }
        Update: {
          confirmado_en?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          orden_compra_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ordenes_compra_confirmaciones_orden_compra_id_fkey"
            columns: ["orden_compra_id"]
            isOneToOne: false
            referencedRelation: "ordenes_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      ordenes_compra_detalles: {
        Row: {
          cantidad_ordenada: number
          cantidad_recibida: number
          created_at: string
          id: string
          orden_compra_id: string
          precio_unitario_compra: number
          producto_id: string
          subtotal: number
        }
        Insert: {
          cantidad_ordenada: number
          cantidad_recibida?: number
          created_at?: string
          id?: string
          orden_compra_id: string
          precio_unitario_compra: number
          producto_id: string
          subtotal: number
        }
        Update: {
          cantidad_ordenada?: number
          cantidad_recibida?: number
          created_at?: string
          id?: string
          orden_compra_id?: string
          precio_unitario_compra?: number
          producto_id?: string
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "ordenes_compra_detalles_orden_compra_id_fkey"
            columns: ["orden_compra_id"]
            isOneToOne: false
            referencedRelation: "ordenes_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordenes_compra_detalles_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      ordenes_compra_entregas: {
        Row: {
          cantidad_bultos: number
          created_at: string
          fecha_entrega_real: string | null
          fecha_programada: string | null
          id: string
          notas: string | null
          numero_entrega: number
          orden_compra_id: string
          status: string
          updated_at: string
        }
        Insert: {
          cantidad_bultos: number
          created_at?: string
          fecha_entrega_real?: string | null
          fecha_programada?: string | null
          id?: string
          notas?: string | null
          numero_entrega: number
          orden_compra_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          cantidad_bultos?: number
          created_at?: string
          fecha_entrega_real?: string | null
          fecha_programada?: string | null
          id?: string
          notas?: string | null
          numero_entrega?: number
          orden_compra_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordenes_compra_entregas_orden_compra_id_fkey"
            columns: ["orden_compra_id"]
            isOneToOne: false
            referencedRelation: "ordenes_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          cliente_id: string
          created_at: string
          datos_fiscales_factura: Json | null
          factura_enviada_al_cliente: boolean
          factura_solicitada_por_cliente: boolean
          facturado: boolean
          fecha_entrega_estimada: string | null
          fecha_factura_enviada: string | null
          fecha_pedido: string
          folio: string
          id: string
          impuestos: number | null
          notas: string | null
          peso_total_kg: number | null
          requiere_factura: boolean
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number | null
          sucursal_id: string | null
          total: number | null
          updated_at: string
          vendedor_id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          datos_fiscales_factura?: Json | null
          factura_enviada_al_cliente?: boolean
          factura_solicitada_por_cliente?: boolean
          facturado?: boolean
          fecha_entrega_estimada?: string | null
          fecha_factura_enviada?: string | null
          fecha_pedido?: string
          folio: string
          id?: string
          impuestos?: number | null
          notas?: string | null
          peso_total_kg?: number | null
          requiere_factura?: boolean
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number | null
          sucursal_id?: string | null
          total?: number | null
          updated_at?: string
          vendedor_id: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          datos_fiscales_factura?: Json | null
          factura_enviada_al_cliente?: boolean
          factura_solicitada_por_cliente?: boolean
          facturado?: boolean
          fecha_entrega_estimada?: string | null
          fecha_factura_enviada?: string | null
          fecha_pedido?: string
          folio?: string
          id?: string
          impuestos?: number | null
          notas?: string | null
          peso_total_kg?: number | null
          requiere_factura?: boolean
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number | null
          sucursal_id?: string | null
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
            foreignKeyName: "pedidos_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "cliente_sucursales"
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
          aplica_ieps: boolean
          aplica_iva: boolean
          categoria: string | null
          codigo: string
          codigo_sat: string | null
          created_at: string
          descripcion: string | null
          fecha_ultima_compra: string | null
          fecha_ultima_fumigacion: string | null
          id: string
          kg_por_unidad: number | null
          maneja_caducidad: boolean | null
          marca: string | null
          nombre: string
          precio_compra: number
          precio_por_kilo: boolean
          precio_venta: number
          presentacion: string | null
          proveedor_preferido_id: string | null
          requiere_fumigacion: boolean
          stock_actual: number
          stock_minimo: number
          ultimo_costo_compra: number | null
          unidad: Database["public"]["Enums"]["unit_type"]
          updated_at: string
        }
        Insert: {
          activo?: boolean | null
          aplica_ieps?: boolean
          aplica_iva?: boolean
          categoria?: string | null
          codigo: string
          codigo_sat?: string | null
          created_at?: string
          descripcion?: string | null
          fecha_ultima_compra?: string | null
          fecha_ultima_fumigacion?: string | null
          id?: string
          kg_por_unidad?: number | null
          maneja_caducidad?: boolean | null
          marca?: string | null
          nombre: string
          precio_compra?: number
          precio_por_kilo?: boolean
          precio_venta?: number
          presentacion?: string | null
          proveedor_preferido_id?: string | null
          requiere_fumigacion?: boolean
          stock_actual?: number
          stock_minimo?: number
          ultimo_costo_compra?: number | null
          unidad?: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
        }
        Update: {
          activo?: boolean | null
          aplica_ieps?: boolean
          aplica_iva?: boolean
          categoria?: string | null
          codigo?: string
          codigo_sat?: string | null
          created_at?: string
          descripcion?: string | null
          fecha_ultima_compra?: string | null
          fecha_ultima_fumigacion?: string | null
          id?: string
          kg_por_unidad?: number | null
          maneja_caducidad?: boolean | null
          marca?: string | null
          nombre?: string
          precio_compra?: number
          precio_por_kilo?: boolean
          precio_venta?: number
          presentacion?: string | null
          proveedor_preferido_id?: string | null
          requiere_fumigacion?: boolean
          stock_actual?: number
          stock_minimo?: number
          ultimo_costo_compra?: number | null
          unidad?: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "productos_proveedor_preferido_id_fkey"
            columns: ["proveedor_preferido_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
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
      proveedor_productos: {
        Row: {
          created_at: string
          id: string
          producto_id: string
          proveedor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          producto_id: string
          proveedor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          producto_id?: string
          proveedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proveedor_productos_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proveedor_productos_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      proveedores: {
        Row: {
          activo: boolean
          created_at: string
          direccion: string | null
          email: string | null
          id: string
          nombre: string
          nombre_contacto: string | null
          notas: string | null
          pais: string
          rfc: string | null
          telefono: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          direccion?: string | null
          email?: string | null
          id?: string
          nombre: string
          nombre_contacto?: string | null
          notas?: string | null
          pais?: string
          rfc?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          direccion?: string | null
          email?: string | null
          id?: string
          nombre?: string
          nombre_contacto?: string | null
          notas?: string | null
          pais?: string
          rfc?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rutas: {
        Row: {
          ayudante_id: string | null
          chofer_id: string
          created_at: string
          fecha_hora_fin: string | null
          fecha_hora_inicio: string | null
          fecha_ruta: string
          folio: string
          id: string
          kilometraje_final: number | null
          kilometraje_inicial: number | null
          kilometros_recorridos: number | null
          notas: string | null
          peso_total_kg: number | null
          status: string | null
          tipo_ruta: string
          updated_at: string
          vehiculo_id: string | null
        }
        Insert: {
          ayudante_id?: string | null
          chofer_id: string
          created_at?: string
          fecha_hora_fin?: string | null
          fecha_hora_inicio?: string | null
          fecha_ruta: string
          folio: string
          id?: string
          kilometraje_final?: number | null
          kilometraje_inicial?: number | null
          kilometros_recorridos?: number | null
          notas?: string | null
          peso_total_kg?: number | null
          status?: string | null
          tipo_ruta?: string
          updated_at?: string
          vehiculo_id?: string | null
        }
        Update: {
          ayudante_id?: string | null
          chofer_id?: string
          created_at?: string
          fecha_hora_fin?: string | null
          fecha_hora_inicio?: string | null
          fecha_ruta?: string
          folio?: string
          id?: string
          kilometraje_final?: number | null
          kilometraje_inicial?: number | null
          kilometros_recorridos?: number | null
          notas?: string | null
          peso_total_kg?: number | null
          status?: string | null
          tipo_ruta?: string
          updated_at?: string
          vehiculo_id?: string | null
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
          {
            foreignKeyName: "rutas_vehiculo_id_fkey"
            columns: ["vehiculo_id"]
            isOneToOne: false
            referencedRelation: "vehiculos"
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
      vehiculos: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          nombre: string
          notas: string | null
          numero_serie: string | null
          peso_maximo_foraneo_kg: number
          peso_maximo_local_kg: number
          placa: string | null
          poliza_seguro_url: string | null
          poliza_seguro_vencimiento: string | null
          status: string
          tarjeta_circulacion_url: string | null
          tarjeta_circulacion_vencimiento: string | null
          tipo: string
          tipo_combustible: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: string
          nombre: string
          notas?: string | null
          numero_serie?: string | null
          peso_maximo_foraneo_kg?: number
          peso_maximo_local_kg?: number
          placa?: string | null
          poliza_seguro_url?: string | null
          poliza_seguro_vencimiento?: string | null
          status?: string
          tarjeta_circulacion_url?: string | null
          tarjeta_circulacion_vencimiento?: string | null
          tipo?: string
          tipo_combustible?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          nombre?: string
          notas?: string | null
          numero_serie?: string | null
          peso_maximo_foraneo_kg?: number
          peso_maximo_local_kg?: number
          placa?: string | null
          poliza_seguro_url?: string | null
          poliza_seguro_vencimiento?: string | null
          status?: string
          tarjeta_circulacion_url?: string | null
          tarjeta_circulacion_vencimiento?: string | null
          tipo?: string
          tipo_combustible?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      vehiculos_mantenimientos: {
        Row: {
          created_at: string
          fecha_mantenimiento: string
          id: string
          kilometraje_actual: number
          kilometraje_proximo: number | null
          notas: string | null
          tipo_mantenimiento: string
          vehiculo_id: string
        }
        Insert: {
          created_at?: string
          fecha_mantenimiento?: string
          id?: string
          kilometraje_actual: number
          kilometraje_proximo?: number | null
          notas?: string | null
          tipo_mantenimiento: string
          vehiculo_id: string
        }
        Update: {
          created_at?: string
          fecha_mantenimiento?: string
          id?: string
          kilometraje_actual?: number
          kilometraje_proximo?: number | null
          notas?: string | null
          tipo_mantenimiento?: string
          vehiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehiculos_mantenimientos_vehiculo_id_fkey"
            columns: ["vehiculo_id"]
            isOneToOne: false
            referencedRelation: "vehiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      zonas: {
        Row: {
          activo: boolean
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
    }
    Views: {
      empleados_vista_segura: {
        Row: {
          activo: boolean | null
          clabe_interbancaria: string | null
          contacto_emergencia_nombre: string | null
          contacto_emergencia_telefono: string | null
          created_at: string | null
          cuenta_bancaria: string | null
          curp: string | null
          direccion: string | null
          email: string | null
          estado_civil: string | null
          fecha_baja: string | null
          fecha_ingreso: string | null
          fecha_nacimiento: string | null
          id: string | null
          motivo_baja: string | null
          nivel_estudios: string | null
          nombre: string | null
          nombre_completo: string | null
          notas: string | null
          numero_dependientes: number | null
          numero_seguro_social: string | null
          periodo_pago: string | null
          primer_apellido: string | null
          puesto: string | null
          rfc: string | null
          segundo_apellido: string | null
          sueldo_bruto: number | null
          telefono: string | null
          tipo_sangre: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          activo?: boolean | null
          clabe_interbancaria?: never
          contacto_emergencia_nombre?: never
          contacto_emergencia_telefono?: never
          created_at?: string | null
          cuenta_bancaria?: never
          curp?: never
          direccion?: never
          email?: string | null
          estado_civil?: never
          fecha_baja?: never
          fecha_ingreso?: string | null
          fecha_nacimiento?: never
          id?: string | null
          motivo_baja?: never
          nivel_estudios?: never
          nombre?: string | null
          nombre_completo?: string | null
          notas?: never
          numero_dependientes?: never
          numero_seguro_social?: never
          periodo_pago?: never
          primer_apellido?: string | null
          puesto?: string | null
          rfc?: never
          segundo_apellido?: string | null
          sueldo_bruto?: never
          telefono?: string | null
          tipo_sangre?: never
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          activo?: boolean | null
          clabe_interbancaria?: never
          contacto_emergencia_nombre?: never
          contacto_emergencia_telefono?: never
          created_at?: string | null
          cuenta_bancaria?: never
          curp?: never
          direccion?: never
          email?: string | null
          estado_civil?: never
          fecha_baja?: never
          fecha_ingreso?: string | null
          fecha_nacimiento?: never
          id?: string | null
          motivo_baja?: never
          nivel_estudios?: never
          nombre?: string | null
          nombre_completo?: string | null
          notas?: never
          numero_dependientes?: never
          numero_seguro_social?: never
          periodo_pago?: never
          primer_apellido?: string | null
          puesto?: string | null
          rfc?: never
          segundo_apellido?: string | null
          sueldo_bruto?: never
          telefono?: string | null
          tipo_sangre?: never
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      gmail_cuentas_segura: {
        Row: {
          access_token: string | null
          activo: boolean | null
          created_at: string | null
          email: string | null
          id: string | null
          nombre: string | null
          proposito: string | null
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          access_token?: never
          activo?: boolean | null
          created_at?: string | null
          email?: string | null
          id?: string | null
          nombre?: string | null
          proposito?: string | null
          refresh_token?: never
          token_expires_at?: never
          updated_at?: string | null
        }
        Update: {
          access_token?: never
          activo?: boolean | null
          created_at?: string | null
          email?: string | null
          id?: string | null
          nombre?: string | null
          proposito?: string | null
          refresh_token?: never
          token_expires_at?: never
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      es_participante_conversacion: {
        Args: { _conversacion_id: string; _user_id: string }
        Returns: boolean
      }
      generar_folio_cotizacion: { Args: never; Returns: string }
      generar_folio_orden_compra: { Args: never; Returns: string }
      generar_notificaciones_fumigacion: { Args: never; Returns: undefined }
      get_cliente_id_for_user: { Args: { user_uuid: string }; Returns: string }
      get_user_roles: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_any_role: {
        Args: { _roles: Database["public"]["Enums"]["app_role"][] }
        Returns: boolean
      }
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
        | "contadora"
      conversation_type:
        | "individual"
        | "grupo_personalizado"
        | "grupo_puesto"
        | "broadcast"
      credit_term: "contado" | "8_dias" | "15_dias" | "30_dias"
      order_status: "pendiente" | "en_ruta" | "entregado" | "cancelado"
      preferencia_facturacion:
        | "siempre_factura"
        | "siempre_remision"
        | "variable"
      unit_type:
        | "kg"
        | "pieza"
        | "caja"
        | "bulto"
        | "costal"
        | "litro"
        | "churla"
        | "cubeta"
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
        "contadora",
      ],
      conversation_type: [
        "individual",
        "grupo_personalizado",
        "grupo_puesto",
        "broadcast",
      ],
      credit_term: ["contado", "8_dias", "15_dias", "30_dias"],
      order_status: ["pendiente", "en_ruta", "entregado", "cancelado"],
      preferencia_facturacion: [
        "siempre_factura",
        "siempre_remision",
        "variable",
      ],
      unit_type: [
        "kg",
        "pieza",
        "caja",
        "bulto",
        "costal",
        "litro",
        "churla",
        "cubeta",
      ],
    },
  },
} as const
