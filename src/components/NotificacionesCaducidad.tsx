import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ProductoCaducidad {
  id: string;
  producto_nombre: string;
  producto_codigo: string;
  fecha_caducidad: string;
  lote: string | null;
  dias_restantes: number;
}

export const NotificacionesCaducidad = () => {
  const [alertas, setAlertas] = useState<ProductoCaducidad[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarAlertasCaducidad();
    
    // Recargar alertas cada 5 minutos
    const interval = setInterval(cargarAlertasCaducidad, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

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
        setAlertas([]);
        setLoading(false);
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

      setAlertas(alertasFormateadas);
    } catch (error) {
      console.error("Error cargando alertas de caducidad:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || alertas.length === 0) return null;

  return (
    <div className="space-y-3">
      {alertas.map((alerta) => (
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
