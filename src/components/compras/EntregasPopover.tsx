import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CalendarCheck, CalendarX, Check, Loader2, Pencil } from "lucide-react";

interface Entrega {
  id: string;
  orden_compra_id: string;
  numero_entrega: number;
  cantidad_bultos: number;
  fecha_programada: string | null;
  status: string;
}

interface EntregasPopoverProps {
  orden: any;
  entregas: Entrega[];
  entregasStatus: { total: number; programadas: number } | undefined;
}

const EntregasPopover = ({ orden, entregas, entregasStatus }: EntregasPopoverProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingFecha, setEditingFecha] = useState("");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  // Filter entregas for this order
  const entregasOrden = entregas.filter(e => e.orden_compra_id === orden.id);

  // For single delivery orders
  const isSingleDelivery = !orden.entregas_multiples;

  const handleSave = async (entregaId: string) => {
    if (!editingFecha) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("ordenes_compra_entregas")
        .update({ fecha_programada: editingFecha })
        .eq("id", entregaId);

      if (error) throw error;

      toast({
        title: "Fecha actualizada",
        description: "La fecha de entrega se actualizó correctamente",
      });

      queryClient.invalidateQueries({ queryKey: ["ordenes_compra_entregas_all"] });
      setEditingId(null);
      setEditingFecha("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSingleDelivery = async () => {
    if (!editingFecha) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("ordenes_compra")
        .update({ fecha_entrega_programada: editingFecha })
        .eq("id", orden.id);

      if (error) throw error;

      toast({
        title: "Fecha actualizada",
        description: "La fecha de entrega se actualizó correctamente",
      });

      queryClient.invalidateQueries({ queryKey: ["ordenes_compra"] });
      setEditingId(null);
      setEditingFecha("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Determine badge display
  let badgeContent;
  let badgeVariant: "default" | "destructive" | "secondary" | "outline" = "outline";
  let badgeClassName = "";

  if (orden.entregas_multiples && entregasStatus) {
    const { total, programadas } = entregasStatus;
    if (programadas === total) {
      badgeVariant = "default";
      badgeClassName = "bg-green-600 hover:bg-green-700 cursor-pointer";
      badgeContent = (
        <>
          <CalendarCheck className="h-3 w-3" />
          {total}/{total}
        </>
      );
    } else if (programadas === 0) {
      badgeVariant = "destructive";
      badgeClassName = "cursor-pointer";
      badgeContent = (
        <>
          <CalendarX className="h-3 w-3" />
          0/{total}
        </>
      );
    } else {
      badgeVariant = "secondary";
      badgeClassName = "cursor-pointer";
      badgeContent = (
        <>
          <CalendarCheck className="h-3 w-3" />
          {programadas}/{total}
        </>
      );
    }
  } else if (isSingleDelivery) {
    if (orden.fecha_entrega_programada) {
      badgeVariant = "default";
      badgeClassName = "bg-green-600 hover:bg-green-700 cursor-pointer";
      badgeContent = (
        <>
          <CalendarCheck className="h-3 w-3" />
          Programada
        </>
      );
    } else {
      badgeVariant = "outline";
      badgeClassName = "text-muted-foreground cursor-pointer";
      badgeContent = (
        <>
          <CalendarX className="h-3 w-3" />
          Sin programar
        </>
      );
    }
  } else {
    badgeVariant = "outline";
    badgeClassName = "text-muted-foreground cursor-pointer";
    badgeContent = (
      <>
        <CalendarX className="h-3 w-3" />
        Sin programar
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Badge 
          variant={badgeVariant} 
          className={`gap-1 ${badgeClassName}`}
        >
          {badgeContent}
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <div className="space-y-3">
          <div className="font-medium text-sm">Fechas de Entrega - {orden.folio}</div>
          
          {isSingleDelivery ? (
            // Single delivery order
            <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
              <div className="flex-1">
                <div className="text-sm font-medium">Entrega única</div>
                {editingId === "single" ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="date"
                      value={editingFecha}
                      onChange={(e) => setEditingFecha(e.target.value)}
                      className="h-8 text-sm"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={handleSaveSingleDelivery}
                      disabled={saving}
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4 text-green-600" />
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-muted-foreground">
                      {orden.fecha_entrega_programada 
                        ? format(new Date(orden.fecha_entrega_programada), "dd MMM yyyy", { locale: es })
                        : "Sin fecha"}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => {
                        setEditingId("single");
                        setEditingFecha(orden.fecha_entrega_programada || "");
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : entregasOrden.length > 0 ? (
            // Multiple deliveries
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {entregasOrden
                .sort((a, b) => a.numero_entrega - b.numero_entrega)
                .map((entrega) => (
                  <div 
                    key={entrega.id} 
                    className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        Entrega #{entrega.numero_entrega}
                        <span className="font-normal text-muted-foreground ml-2">
                          ({entrega.cantidad_bultos} bultos)
                        </span>
                      </div>
                      {editingId === entrega.id ? (
                        <div className="flex items-center gap-2 mt-1">
                          <Input
                            type="date"
                            value={editingFecha}
                            onChange={(e) => setEditingFecha(e.target.value)}
                            className="h-8 text-sm"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => handleSave(entrega.id)}
                            disabled={saving}
                          >
                            {saving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4 text-green-600" />
                            )}
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm text-muted-foreground">
                            {entrega.fecha_programada 
                              ? format(new Date(entrega.fecha_programada), "dd MMM yyyy", { locale: es })
                              : "Sin fecha"}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => {
                              setEditingId(entrega.id);
                              setEditingFecha(entrega.fecha_programada || "");
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                    {entrega.fecha_programada ? (
                      <CalendarCheck className="h-4 w-4 text-green-600 flex-shrink-0" />
                    ) : (
                      <CalendarX className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground py-2">
              No hay entregas registradas
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default EntregasPopover;
