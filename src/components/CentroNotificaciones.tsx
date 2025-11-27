import { Bell, PackageX, AlertCircle, X, IdCard } from "lucide-react";
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

export const CentroNotificaciones = () => {
  const { alertasCaducidad, notificacionesStock, alertasLicencias, totalCount, loading, marcarComoLeida } = useNotificaciones();
  const navigate = useNavigate();

  const handleLicenciaClick = (puesto: string) => {
    const tabMap: Record<string, string> = {
      "Chofer": "chofer",
      "Vendedor": "vendedor"
    };
    const tab = tabMap[puesto] || "todos";
    navigate(`/empleados?tab=${tab}`);
  };

  const handleCaducidadClick = () => {
    navigate("/inventario");
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {totalCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center px-1 text-xs"
            >
              {totalCount > 99 ? "99+" : totalCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Notificaciones</h3>
          {totalCount > 0 && (
            <Badge variant="secondary">{totalCount}</Badge>
          )}
        </div>

        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground">
              Cargando notificaciones...
            </div>
          ) : totalCount === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No hay notificaciones</p>
            </div>
          ) : (
            <div className="p-2">
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
              {alertasLicencias.length > 0 && (
                <div className="mb-2">
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                    Licencias de Conductor
                  </div>
                  {alertasLicencias.map((alerta) => (
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
                          // Aquí se podría implementar lógica para descartar temporalmente
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {alertasCaducidad.length > 0 && <Separator className="my-2" />}
                </div>
              )}

              {/* Alertas de Caducidad */}
              {alertasCaducidad.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                    Próximos a Caducar
                  </div>
                  {alertasCaducidad.map((alerta) => (
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
                          // Aquí se podría implementar lógica para descartar temporalmente
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
