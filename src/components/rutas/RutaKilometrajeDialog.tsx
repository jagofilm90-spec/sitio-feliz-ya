import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Play, Square, AlertTriangle, Gauge, Clock } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Ruta {
  id: string;
  folio: string;
  status: string;
  kilometraje_inicial: number | null;
  kilometraje_final: number | null;
  kilometros_recorridos: number | null;
  fecha_hora_inicio: string | null;
  fecha_hora_fin: string | null;
  vehiculo?: {
    nombre: string;
  };
  chofer?: {
    full_name: string;
  };
}

interface RutaKilometrajeDialogProps {
  ruta: Ruta | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  mode: "iniciar" | "finalizar";
}

const RutaKilometrajeDialog = ({
  ruta,
  open,
  onOpenChange,
  onSuccess,
  mode,
}: RutaKilometrajeDialogProps) => {
  const [kilometraje, setKilometraje] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!ruta || !kilometraje) return;

    const km = parseFloat(kilometraje);
    if (isNaN(km) || km < 0) {
      toast({
        title: "Error",
        description: "Ingresa un kilometraje válido",
        variant: "destructive",
      });
      return;
    }

    // Validación: el km final debe ser mayor que el inicial
    if (mode === "finalizar" && ruta.kilometraje_inicial !== null) {
      if (km < ruta.kilometraje_inicial) {
        toast({
          title: "Error",
          description: "El kilometraje final debe ser mayor que el inicial",
          variant: "destructive",
        });
        return;
      }
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      
      if (mode === "iniciar") {
        const { error } = await supabase
          .from("rutas")
          .update({
            kilometraje_inicial: km,
            fecha_hora_inicio: now,
            status: "en_curso",
          })
          .eq("id", ruta.id);

        if (error) throw error;

        toast({ 
          title: "Ruta iniciada",
          description: `Kilometraje inicial registrado: ${km.toLocaleString()} km`,
        });
      } else {
        const { error } = await supabase
          .from("rutas")
          .update({
            kilometraje_final: km,
            fecha_hora_fin: now,
            status: "completada",
          })
          .eq("id", ruta.id);

        if (error) throw error;

        // Liberar vehículo
        if (ruta.vehiculo) {
          await supabase
            .from("vehiculos")
            .update({ status: "disponible" })
            .eq("nombre", ruta.vehiculo.nombre);
        }

        const kmRecorridos = ruta.kilometraje_inicial !== null 
          ? km - ruta.kilometraje_inicial 
          : 0;

        toast({ 
          title: "Ruta completada",
          description: `Kilometraje final: ${km.toLocaleString()} km | Recorridos: ${kmRecorridos.toLocaleString()} km`,
        });
      }

      setKilometraje("");
      onOpenChange(false);
      onSuccess();
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

  // Calcular km esperados vs reportados para alertas
  const getKilometrajeWarning = () => {
    if (mode !== "finalizar" || !ruta?.kilometraje_inicial) return null;
    
    const km = parseFloat(kilometraje);
    if (isNaN(km)) return null;

    const recorrido = km - ruta.kilometraje_inicial;
    
    // Alertas si el recorrido parece muy bajo o muy alto (ajustable)
    if (recorrido < 10 && recorrido >= 0) {
      return {
        type: "warning" as const,
        message: `Solo ${recorrido} km recorridos. ¿Es correcto?`,
      };
    }
    if (recorrido > 500) {
      return {
        type: "warning" as const,
        message: `${recorrido.toLocaleString()} km es un recorrido muy largo. Verifica el dato.`,
      };
    }
    return null;
  };

  const warning = getKilometrajeWarning();

  if (!ruta) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "iniciar" ? (
              <>
                <Play className="h-5 w-5 text-green-600" />
                Iniciar Ruta
              </>
            ) : (
              <>
                <Square className="h-5 w-5 text-red-600" />
                Finalizar Ruta
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {mode === "iniciar"
              ? "Registra el kilometraje inicial del vehículo antes de salir"
              : "Registra el kilometraje final para completar la ruta"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 p-3 bg-muted rounded-lg text-sm">
            <div>
              <p className="text-muted-foreground">Folio</p>
              <p className="font-medium">{ruta.folio}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Vehículo</p>
              <p className="font-medium">{ruta.vehiculo?.nombre || "—"}</p>
            </div>
          </div>

          {mode === "finalizar" && ruta.kilometraje_inicial !== null && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Clock className="h-4 w-4" />
                Datos de inicio
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Km inicial</p>
                  <p className="font-medium">{ruta.kilometraje_inicial.toLocaleString()} km</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Hora inicio</p>
                  <p className="font-medium">
                    {ruta.fecha_hora_inicio
                      ? format(new Date(ruta.fecha_hora_inicio), "HH:mm", { locale: es })
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Gauge className="h-4 w-4" />
              {mode === "iniciar" ? "Kilometraje Inicial" : "Kilometraje Final"} *
            </Label>
            <Input
              type="number"
              value={kilometraje}
              onChange={(e) => setKilometraje(e.target.value)}
              placeholder="Ej: 125,430"
              autoComplete="off"
              min={mode === "finalizar" && ruta.kilometraje_inicial ? ruta.kilometraje_inicial : 0}
            />
            {mode === "finalizar" && kilometraje && ruta.kilometraje_inicial !== null && (
              <p className="text-sm text-muted-foreground">
                Km a recorrer: {(parseFloat(kilometraje) - ruta.kilometraje_inicial).toLocaleString()} km
              </p>
            )}
          </div>

          {warning && (
            <Alert variant="default" className="border-yellow-500 bg-yellow-500/10">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-600">
                {warning.message}
              </AlertDescription>
            </Alert>
          )}

          <p className="text-xs text-muted-foreground">
            * La hora se registrará automáticamente al confirmar
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!kilometraje || saving}
            className={mode === "iniciar" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
          >
            {saving
              ? "Guardando..."
              : mode === "iniciar"
              ? "Iniciar Ruta"
              : "Finalizar Ruta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RutaKilometrajeDialog;
