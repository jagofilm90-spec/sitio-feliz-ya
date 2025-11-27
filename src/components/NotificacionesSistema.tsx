import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, PackageX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

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

export const NotificacionesSistema = () => {
  const [alertasCaducidad, setAlertasCaducidad] = useState<ProductoCaducidad[]>([]);
  const [notificacionesStock, setNotificacionesStock] = useState<NotificacionStockBajo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarNotificaciones();
    
    // Recargar notificaciones cada 5 minutos
    const interval = setInterval(cargarNotificaciones, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const cargarNotificaciones = async () => {
    await Promise.all([
      cargarAlertasCaducidad(),
      cargarNotificacionesStock()
    ]);
    setLoading(false);
  };

  const cargarAlertasCaducidad = async () => {
    try {
      // Obtener productos que manejan caducidad y tienen stock
      const { data: productos, error: productosError } = await supabase
        .from("productos")
        .select("id, nombre, codigo, stock_actual")
        .eq("maneja_caducidad", true)
        .gt("stock_actual", 0);

      if (productosError) throw productosError;
      if (!productos || productos.length === 0) {
        setAlertasCaducidad([]);
        return;
      }

      const productosIds = productos.map(p => p.id);

      // Obtener movimientos de entrada con fechas de caducidad próximas
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

      if (movimientosError) throw movimientosError;

      // Combinar datos y calcular días restantes
      const alertasFormateadas: ProductoCaducidad[] = [];
      const lotesUnicos = new Set<string>();

      movimientos?.forEach(mov => {
        const producto = productos.find(p => p.id === mov.producto_id);
        if (!producto) return;

        // Evitar duplicados por lote
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

      setAlertasCaducidad(alertasFormateadas);
    } catch (error) {
      console.error("Error cargando alertas de caducidad:", error);
    }
  };

  const cargarNotificacionesStock = async () => {
    try {
      const { data, error } = await supabase
        .from("notificaciones")
        .select("*")
        .eq("tipo", "stock_bajo")
        .eq("leida", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotificacionesStock(data || []);
    } catch (error) {
      console.error("Error cargando notificaciones de stock:", error);
    }
  };

  const marcarComoLeida = async (notificacionId: string) => {
    try {
      const { error } = await supabase
        .from("notificaciones")
        .update({ leida: true })
        .eq("id", notificacionId);

      if (error) throw error;
      
      // Actualizar estado local
      setNotificacionesStock(prev => prev.filter(n => n.id !== notificacionId));
    } catch (error) {
      console.error("Error marcando notificación como leída:", error);
    }
  };

  if (loading || (alertasCaducidad.length === 0 && notificacionesStock.length === 0)) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Alertas de stock bajo */}
      {notificacionesStock.map((notif) => (
        <Alert key={notif.id} variant="destructive">
          <PackageX className="h-4 w-4" />
          <AlertTitle className="flex items-center justify-between">
            <span>{notif.titulo}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => marcarComoLeida(notif.id)}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </AlertTitle>
          <AlertDescription>{notif.descripcion}</AlertDescription>
        </Alert>
      ))}

      {/* Alertas de caducidad */}
      {alertasCaducidad.map((alerta) => (
        <Alert key={alerta.id} variant={alerta.dias_restantes <= 7 ? "destructive" : "default"}>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="flex items-center gap-2">
            Producto próximo a caducar
            <Badge variant={alerta.dias_restantes <= 7 ? "destructive" : "secondary"}>
              {alerta.dias_restantes} {alerta.dias_restantes === 1 ? "día" : "días"}
            </Badge>
          </AlertTitle>
          <AlertDescription>
            <strong>{alerta.producto_codigo} - {alerta.producto_nombre}</strong>
            {alerta.lote && ` (Lote: ${alerta.lote})`}
            <br />
            Caduca: {new Date(alerta.fecha_caducidad).toLocaleDateString("es-MX", {
              day: "2-digit",
              month: "long",
              year: "numeric"
            })}
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
};
