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
        ]
      }
      ordenes_compra: {
        Row: {
          creado_por: string
          created_at: string
          fecha_entrega_programada: string | null
          fecha_entrega_real: string | null
          fecha_orden: string
          folio: string
          id: string
          impuestos: number
          motivo_devolucion: string | null
          notas: string | null
          proveedor_id: string
          status: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          creado_por: string
          created_at?: string
          fecha_entrega_programada?: string | null
          fecha_entrega_real?: string | null
          fecha_orden?: string
          folio: string
          id?: string
          impuestos?: number
          motivo_devolucion?: string | null
          notas?: string | null
          proveedor_id: string
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          creado_por?: string
          created_at?: string
          fecha_entrega_programada?: string | null
          fecha_entrega_real?: string | null
          fecha_orden?: string
          folio?: string
          id?: string
          impuestos?: number
          motivo_devolucion?: string | null
          notas?: string | null
          proveedor_id?: string
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordenes_compra_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
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
          peso_total_kg: number | null
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
          peso_total_kg?: number | null
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
          peso_total_kg?: number | null
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
          aplica_ieps: boolean
          aplica_iva: boolean
          categoria: string | null
          codigo: string
          created_at: string
          descripcion: string | null
          fecha_ultima_compra: string | null
          fecha_ultima_fumigacion: string | null
          id: string
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
          created_at?: string
          descripcion?: string | null
          fecha_ultima_compra?: string | null
          fecha_ultima_fumigacion?: string | null
          id?: string
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
          created_at?: string
          descripcion?: string | null
          fecha_ultima_compra?: string | null
          fecha_ultima_fumigacion?: string | null
          id?: string
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
          fecha_ruta: string
          folio: string
          id: string
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
          fecha_ruta: string
          folio: string
          id?: string
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
          fecha_ruta?: string
          folio?: string
          id?: string
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
          peso_maximo_foraneo_kg: number
          peso_maximo_local_kg: number
          placa: string | null
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: string
          nombre: string
          notas?: string | null
          peso_maximo_foraneo_kg?: number
          peso_maximo_local_kg?: number
          placa?: string | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          nombre?: string
          notas?: string | null
          peso_maximo_foraneo_kg?: number
          peso_maximo_local_kg?: number
          placa?: string | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
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
      [_ in never]: never
    }
    Functions: {
      es_participante_conversacion: {
        Args: { _conversacion_id: string; _user_id: string }
        Returns: boolean
      }
      generar_notificaciones_fumigacion: { Args: never; Returns: undefined }
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
      conversation_type:
        | "individual"
        | "grupo_personalizado"
        | "grupo_puesto"
        | "broadcast"
      credit_term: "contado" | "8_dias" | "15_dias" | "30_dias"
      order_status: "pendiente" | "en_ruta" | "entregado" | "cancelado"
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
      ],
      conversation_type: [
        "individual",
        "grupo_personalizado",
        "grupo_puesto",
        "broadcast",
      ],
      credit_term: ["contado", "8_dias", "15_dias", "30_dias"],
      order_status: ["pendiente", "en_ruta", "entregado", "cancelado"],
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
