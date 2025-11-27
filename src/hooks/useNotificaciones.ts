import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ProductoCaducidad {
  id: string;
  producto_nombre: string;
  producto_codigo: string;
  fecha_caducidad: string;
  lote: string | null;
  dias_restantes: number;
}

interface NotificacionStockBajo {
  id: string;
  tipo: string;
  titulo: string;
  descripcion: string;
  created_at: string;
  leida: boolean;
}

interface LicenciaAlerta {
  id: string;
  empleado_nombre: string;
  empleado_puesto: string;
  fecha_vencimiento: string;
  dias_restantes: number;
  vencida: boolean;
}

export interface NotificacionesData {
  alertasCaducidad: ProductoCaducidad[];
  notificacionesStock: NotificacionStockBajo[];
  alertasLicencias: LicenciaAlerta[];
  totalCount: number;
}

export const useNotificaciones = () => {
  const [notificaciones, setNotificaciones] = useState<NotificacionesData>({
    alertasCaducidad: [],
    notificacionesStock: [],
    alertasLicencias: [],
    totalCount: 0,
  });
  const [loading, setLoading] = useState(true);

  const cargarNotificaciones = async () => {
    try {
      const [caducidad, stock, licencias] = await Promise.all([
        cargarAlertasCaducidad(),
        cargarNotificacionesStock(),
        cargarAlertasLicencias(),
      ]);

      const total = caducidad.length + stock.length + licencias.length;
      setNotificaciones({
        alertasCaducidad: caducidad,
        notificacionesStock: stock,
        alertasLicencias: licencias,
        totalCount: total,
      });
    } catch (error) {
      console.error("Error cargando notificaciones:", error);
    } finally {
      setLoading(false);
    }
  };

  const cargarAlertasCaducidad = async (): Promise<ProductoCaducidad[]> => {
    try {
      const { data: productos, error: productosError } = await supabase
        .from("productos")
        .select("id, nombre, codigo, stock_actual")
        .eq("maneja_caducidad", true)
        .gt("stock_actual", 0);

      if (productosError || !productos || productos.length === 0) {
        return [];
      }

      const productosIds = productos.map(p => p.id);
      const fechaActual = new Date();
      const fecha30Dias = new Date();
      fecha30Dias.setDate(fecha30Dias.getDate() + 30);

      const { data: movimientos, error: movimientosError } = await supabase
        .from("inventario_movimientos")
        .select("producto_id, fecha_caducidad, lote")
        .in("producto_id", productosIds)
        .eq("tipo_movimiento", "entrada")
        .not("fecha_caducidad", "is", null)
        .lte("fecha_caducidad", fecha30Dias.toISOString().split("T")[0])
        .gte("fecha_caducidad", fechaActual.toISOString().split("T")[0])
        .order("fecha_caducidad", { ascending: true });

      if (movimientosError) return [];

      const alertasFormateadas: ProductoCaducidad[] = [];
      const lotesUnicos = new Set<string>();

      movimientos?.forEach(mov => {
        const producto = productos.find(p => p.id === mov.producto_id);
        if (!producto) return;

        const loteKey = `${mov.producto_id}-${mov.lote || "sin-lote"}-${mov.fecha_caducidad}`;
        if (lotesUnicos.has(loteKey)) return;
        lotesUnicos.add(loteKey);

        const fechaCad = new Date(mov.fecha_caducidad!);
        const diasRestantes = Math.ceil((fechaCad.getTime() - fechaActual.getTime()) / (1000 * 60 * 60 * 24));

        alertasFormateadas.push({
          id: loteKey,
          producto_nombre: producto.nombre,
          producto_codigo: producto.codigo,
          fecha_caducidad: mov.fecha_caducidad!,
          lote: mov.lote,
          dias_restantes: diasRestantes,
        });
      });

      return alertasFormateadas;
    } catch (error) {
      console.error("Error cargando alertas de caducidad:", error);
      return [];
    }
  };

  const cargarNotificacionesStock = async (): Promise<NotificacionStockBajo[]> => {
    try {
      const { data, error } = await supabase
        .from("notificaciones")
        .select("*")
        .eq("tipo", "stock_bajo")
        .eq("leida", false)
        .order("created_at", { ascending: false });

      if (error) return [];
      return data || [];
    } catch (error) {
      console.error("Error cargando notificaciones de stock:", error);
      return [];
    }
  };

  const cargarAlertasLicencias = async (): Promise<LicenciaAlerta[]> => {
    try {
      const fechaActual = new Date();
      const fecha30Dias = new Date();
      fecha30Dias.setDate(fecha30Dias.getDate() + 30);

      // Obtener empleados que son choferes o vendedores
      const { data: empleados, error: empleadosError } = await supabase
        .from("empleados")
        .select("id, nombre_completo, puesto")
        .eq("activo", true)
        .in("puesto", ["Chofer", "Vendedor"]);

      if (empleadosError || !empleados || empleados.length === 0) {
        return [];
      }

      const empleadosIds = empleados.map(e => e.id);

      // Obtener documentos de licencias
      const { data: documentos, error: documentosError } = await supabase
        .from("empleados_documentos")
        .select("empleado_id, fecha_vencimiento")
        .in("empleado_id", empleadosIds)
        .eq("tipo_documento", "licencia_conducir")
        .not("fecha_vencimiento", "is", null);

      if (documentosError || !documentos) return [];

      const alertas: LicenciaAlerta[] = [];

      documentos.forEach(doc => {
        const empleado = empleados.find(e => e.id === doc.empleado_id);
        if (!empleado || !doc.fecha_vencimiento) return;

        const fechaVencimiento = new Date(doc.fecha_vencimiento);
        
        // Excluir licencias permanentes (año 2099)
        if (fechaVencimiento.getFullYear() === 2099) return;

        const diasRestantes = Math.ceil((fechaVencimiento.getTime() - fechaActual.getTime()) / (1000 * 60 * 60 * 24));
        
        // Mostrar si está vencida o vence en los próximos 30 días
        if (diasRestantes <= 30) {
          alertas.push({
            id: `${doc.empleado_id}-licencia`,
            empleado_nombre: empleado.nombre_completo,
            empleado_puesto: empleado.puesto,
            fecha_vencimiento: doc.fecha_vencimiento,
            dias_restantes: diasRestantes,
            vencida: diasRestantes < 0,
          });
        }
      });

      // Ordenar: vencidas primero, luego por días restantes
      return alertas.sort((a, b) => {
        if (a.vencida && !b.vencida) return -1;
        if (!a.vencida && b.vencida) return 1;
        return a.dias_restantes - b.dias_restantes;
      });
    } catch (error) {
      console.error("Error cargando alertas de licencias:", error);
      return [];
    }
  };

  useEffect(() => {
    cargarNotificaciones();

    // Recargar cada 2 minutos
    const interval = setInterval(cargarNotificaciones, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const marcarComoLeida = async (notificacionId: string) => {
    try {
      const { error } = await supabase
        .from("notificaciones")
        .update({ leida: true })
        .eq("id", notificacionId);

      if (error) throw error;
      
      // Recargar notificaciones
      await cargarNotificaciones();
    } catch (error) {
      console.error("Error marcando notificación como leída:", error);
    }
  };

  return {
    ...notificaciones,
    loading,
    marcarComoLeida,
    recargar: cargarNotificaciones,
  };
};
