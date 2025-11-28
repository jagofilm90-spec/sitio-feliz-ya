import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Mail, X } from "lucide-react";
import { useState, useEffect } from "react";

interface OCAutorizadaAlertProps {
  onNavigateToOC?: (ordenId: string) => void;
}

const OCAutorizadaAlert = ({ onNavigateToOC }: OCAutorizadaAlertProps) => {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Get current user
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    fetchUser();
  }, []);

  // Fetch authorized OC notifications for the current user
  const { data: ocAutorizadas = [] } = useQuery({
    queryKey: ["oc-autorizadas-notifications", currentUserId],
    queryFn: async () => {
      if (!currentUserId) return [];

      // Get OCs created by current user that are authorized but not yet sent
      const { data: ordenes, error } = await supabase
        .from("ordenes_compra")
        .select(`
          id,
          folio,
          total,
          proveedores (nombre)
        `)
        .eq("creado_por", currentUserId)
        .eq("status", "autorizada")
        .order("fecha_autorizacion", { ascending: false });

      if (error) {
        console.error("Error fetching authorized OCs:", error);
        return [];
      }

      return ordenes || [];
    },
    enabled: !!currentUserId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Filter out dismissed alerts
  const visibleAlerts = ocAutorizadas.filter(oc => !dismissed.includes(oc.id));

  if (visibleAlerts.length === 0) return null;

  return (
    <div className="space-y-3 mb-6">
      {visibleAlerts.map((oc) => (
        <Alert 
          key={oc.id} 
          className="border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-800 animate-in fade-in slide-in-from-top-2"
        >
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <AlertTitle className="text-green-800 dark:text-green-300 font-semibold flex items-center justify-between">
            <span>¡Orden {oc.folio} autorizada!</span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 -mr-2"
              onClick={() => setDismissed(prev => [...prev, oc.id])}
            >
              <X className="h-4 w-4" />
            </Button>
          </AlertTitle>
          <AlertDescription className="text-green-700 dark:text-green-400">
            <p className="mb-3">
              Tu orden de compra a <strong>{oc.proveedores?.nombre}</strong> por{" "}
              <strong>${oc.total?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</strong>{" "}
              ha sido autorizada. Ya puedes enviarla al proveedor.
            </p>
            <Button 
              size="sm" 
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => onNavigateToOC?.(oc.id)}
            >
              <Mail className="h-4 w-4 mr-2" />
              Enviar al Proveedor
            </Button>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
};

export default OCAutorizadaAlert;
