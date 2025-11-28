import { useMemo, useState, useEffect } from "react";
import { Bell, PackageX, AlertCircle, X, IdCard, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useNotificaciones } from "@/hooks/useNotificaciones";
import { useNavigate } from "react-router-dom";

interface DismissedNotification {
  id: string;
  dismissedAt: number;
}

const STORAGE_KEY = "dismissed-notifications";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const CentroNotificaciones = () => {
  const { alertasCaducidad, notificacionesStock, alertasLicencias, autorizacionesOC, totalCount, loading, marcarComoLeida, isAdmin } = useNotificaciones();
  const navigate = useNavigate();
  const [dismissedLicencias, setDismissedLicencias] = useState<string[]>([]);
  const [dismissedCaducidad, setDismissedCaducidad] = useState<string[]>([]);

  // Cargar notificaciones descartadas del localStorage al montar
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const dismissed: DismissedNotification[] = JSON.parse(stored);
        const now = Date.now();
        
        // Filtrar las que aún no han pasado 24 horas
        const stillValid = dismissed.filter(d => (now - d.dismissedAt) < ONE_DAY_MS);
        
        // Actualizar localStorage con las válidas
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stillValid));
        
        // Separar por tipo (L = licencias, C = caducidad)
        const licencias = stillValid.filter(d => d.id.startsWith("L-")).map(d => d.id);
        const caducidad = stillValid.filter(d => d.id.startsWith("C-")).map(d => d.id);
        
        setDismissedLicencias(licencias);
        setDismissedCaducidad(caducidad);
      }
    } catch (error) {
      console.error("Error loading dismissed notifications:", error);
    }
  }, []);

  // Guardar en localStorage cuando cambian las notificaciones descartadas
  useEffect(() => {
    try {
      const now = Date.now();
      const allDismissed: DismissedNotification[] = [
        ...dismissedLicencias.map(id => ({ id, dismissedAt: now })),
        ...dismissedCaducidad.map(id => ({ id, dismissedAt: now }))
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allDismissed));
    } catch (error) {
      console.error("Error saving dismissed notifications:", error);
    }
  }, [dismissedLicencias, dismissedCaducidad]);

  const visibleAlertasLicencias = useMemo(
    () => alertasLicencias.filter((a) => !dismissedLicencias.includes(`L-${a.id}`)),
    [alertasLicencias, dismissedLicencias]
  );

  const visibleAlertasCaducidad = useMemo(
    () => alertasCaducidad.filter((a) => !dismissedCaducidad.includes(`C-${a.id}`)),
    [alertasCaducidad, dismissedCaducidad]
  );

  const computedCount = notificacionesStock.length + visibleAlertasLicencias.length + visibleAlertasCaducidad.length + autorizacionesOC.length;

  const handleLicenciaClick = (puesto: string) => {
    const tabMap: Record<string, string> = {
      "Chofer": "chofer",
      "Vendedor": "vendedor",
    };
    const tab = tabMap[puesto] || "todos";
    navigate(`/empleados?tab=${tab}`);
  };

  const handleCaducidadClick = () => {
    navigate("/inventario");
  };

  const handleAutorizacionClick = (ordenCompraId: string, notificacionId: string) => {
    marcarComoLeida(notificacionId);
    navigate(`/compras?aprobar=${ordenCompraId}`);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {computedCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center px-1 text-xs"
            >
              {computedCount > 99 ? "99+" : computedCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Notificaciones</h3>
          {computedCount > 0 && (
            <Badge variant="secondary">{computedCount}</Badge>
          )}
        </div>

        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground">
              Cargando notificaciones...
            </div>
          ) : computedCount === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No hay notificaciones</p>
            </div>
          ) : (
            <div className="p-2">
              {/* Autorizaciones de Órdenes de Compra - Prioritarias */}
              {autorizacionesOC.length > 0 && (
                <div className="mb-2">
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                    Autorizaciones Pendientes
                  </div>
                  {autorizacionesOC.map((notif) => (
                    <div
                      key={notif.id}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 mb-2"
                      onClick={() => handleAutorizacionClick(notif.orden_compra_id, notif.id)}
                    >
                      <FileCheck className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{notif.titulo}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {notif.descripcion}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(notif.created_at).toLocaleDateString("es-MX", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
                        Revisar
                      </Badge>
                    </div>
                  ))}
                  {(notificacionesStock.length > 0 || visibleAlertasLicencias.length > 0 || visibleAlertasCaducidad.length > 0) && (
                    <Separator className="my-2" />
                  )}
                </div>
              )}

              {/* Notificaciones de Stock Bajo */}
              {notificacionesStock.length > 0 && (
                <div className="mb-2">
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                    Stock Bajo
                  </div>
                  {notificacionesStock.map((notif) => (
                    <div
                      key={notif.id}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => {
                        marcarComoLeida(notif.id);
                        navigate("/productos");
                      }}
                    >
                      <PackageX className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{notif.titulo}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {notif.descripcion}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(notif.created_at).toLocaleDateString("es-MX", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                  {alertasCaducidad.length > 0 && <Separator className="my-2" />}
                </div>
              )}

              {/* Alertas de Licencias */}
              {visibleAlertasLicencias.length > 0 && (
                <div className="mb-2">
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                    Licencias de Conductor
                  </div>
                  {visibleAlertasLicencias.map((alerta) => (
                    <div
                      key={alerta.id}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                    >
                      <IdCard 
                        className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
                          alerta.vencida ? "text-red-500" : "text-yellow-500"
                        }`}
                      />
                      <div 
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => handleLicenciaClick(alerta.empleado_puesto)}
                      >
                        <p className="text-sm font-medium">
                          {alerta.empleado_nombre}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {alerta.empleado_puesto} • {" "}
                          {alerta.vencida 
                            ? `Vencida hace ${Math.abs(alerta.dias_restantes)} ${Math.abs(alerta.dias_restantes) === 1 ? "día" : "días"}`
                            : `Vence en ${alerta.dias_restantes} ${alerta.dias_restantes === 1 ? "día" : "días"}`
                          }
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(alerta.fecha_vencimiento).toLocaleDateString("es-MX", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDismissedLicencias((prev) => [...prev, `L-${alerta.id}`]);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {visibleAlertasCaducidad.length > 0 && <Separator className="my-2" />}
                </div>
              )}

              {/* Alertas de Caducidad */}
              {visibleAlertasCaducidad.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                    Próximos a Caducar
                  </div>
                  {visibleAlertasCaducidad.map((alerta) => (
                    <div
                      key={alerta.id}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                    >
                      <AlertCircle 
                        className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
                          alerta.dias_restantes <= 7 ? "text-red-500" : "text-yellow-500"
                        }`}
                      />
                      <div 
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={handleCaducidadClick}
                      >
                        <p className="text-sm font-medium">
                          {alerta.producto_codigo} - {alerta.producto_nombre}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {alerta.lote && `Lote: ${alerta.lote} • `}
                          Caduca en {alerta.dias_restantes} {alerta.dias_restantes === 1 ? "día" : "días"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(alerta.fecha_caducidad).toLocaleDateString("es-MX", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDismissedCaducidad((prev) => [...prev, `C-${alerta.id}`]);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
