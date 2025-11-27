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

export interface NotificacionesData {
  alertasCaducidad: ProductoCaducidad[];
  notificacionesStock: NotificacionStockBajo[];
  totalCount: number;
}

export const useNotificaciones = () => {
  const [notificaciones, setNotificaciones] = useState<NotificacionesData>({
    alertasCaducidad: [],
    notificacionesStock: [],
    totalCount: 0,
  });
  const [loading, setLoading] = useState(true);

  const cargarNotificaciones = async () => {
    try {
      const [caducidad, stock] = await Promise.all([
        cargarAlertasCaducidad(),
        cargarNotificacionesStock(),
      ]);

      const total = caducidad.length + stock.length;
      setNotificaciones({
        alertasCaducidad: caducidad,
        notificacionesStock: stock,
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
