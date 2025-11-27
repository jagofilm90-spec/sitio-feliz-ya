import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, ChevronUp, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface Lote {
  id: string;
  cantidad_disponible: number;
  precio_compra: number;
  fecha_entrada: string;
  fecha_caducidad: string | null;
  lote_referencia: string | null;
}

interface LotesDesgloseProps {
  productoId: string;
  productoNombre: string;
  stockTotal: number;
}

export const LotesDesglose = ({ productoId, productoNombre, stockTotal }: LotesDesgloseProps) => {
  const [expanded, setExpanded] = useState(false);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (expanded && lotes.length === 0) {
      loadLotes();
    }
  }, [expanded]);

  const loadLotes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("inventario_lotes")
        .select("*")
        .eq("producto_id", productoId)
        .gt("cantidad_disponible", 0)
        .order("fecha_caducidad", { ascending: true, nullsFirst: false })
        .order("fecha_entrada", { ascending: true });

      if (error) throw error;
      setLotes(data || []);
    } catch (error) {
      console.error("Error loading lotes:", error);
    } finally {
      setLoading(false);
    }
  };

  const getEstadoCaducidad = (fechaCaducidad: string | null) => {
    if (!fechaCaducidad) return null;
    
    const hoy = new Date();
    const fechaCad = new Date(fechaCaducidad);
    const diasRestantes = Math.ceil((fechaCad.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diasRestantes < 0) return { label: "Vencido", variant: "destructive" as const };
    if (diasRestantes <= 30) return { label: "Próximo a vencer", variant: "destructive" as const };
    if (diasRestantes <= 60) return { label: "Vigente", variant: "default" as const };
    return { label: "Vigente", variant: "default" as const };
  };

  if (stockTotal === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        Sin stock
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setExpanded(!expanded)}
        className="h-8 px-2"
      >
        <Package className="h-4 w-4 mr-2" />
        {expanded ? (
          <>
            <ChevronUp className="h-4 w-4 mr-1" />
            Ocultar lotes
          </>
        ) : (
          <>
            <ChevronDown className="h-4 w-4 mr-1" />
            Ver lotes ({lotes.length > 0 ? lotes.length : "..."})
          </>
        )}
      </Button>

      {expanded && (
        <div className="mt-2 space-y-2 pl-4 border-l-2 border-muted">
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando lotes...</p>
          ) : lotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay lotes registrados para este producto
            </p>
          ) : (
            lotes.map((lote) => {
              const estadoCaducidad = getEstadoCaducidad(lote.fecha_caducidad);
              
              return (
                <div
                  key={lote.id}
                  className="p-3 bg-card border rounded-lg space-y-2 text-sm hover:border-primary/50 transition-colors"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      {lote.lote_referencia && (
                        <p className="font-semibold text-base mb-1">
                          {lote.lote_referencia}
                        </p>
                      )}
                      <p className="text-lg font-bold text-primary">
                        ${lote.precio_compra.toFixed(2)}
                        <span className="text-xs font-normal text-muted-foreground ml-1">
                          por unidad
                        </span>
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Disponible: <span className="font-medium text-foreground">{lote.cantidad_disponible} unidades</span>
                      </p>
                    </div>
                    {estadoCaducidad && (
                      <Badge variant={estadoCaducidad.variant} className="text-xs shrink-0">
                        {estadoCaducidad.label}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5 pt-2 border-t">
                    <p>
                      Entrada: {format(new Date(lote.fecha_entrada), "dd MMM yyyy")}
                    </p>
                    {lote.fecha_caducidad && (
                      <p>
                        Caducidad: {format(new Date(lote.fecha_caducidad), "dd MMM yyyy")}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
