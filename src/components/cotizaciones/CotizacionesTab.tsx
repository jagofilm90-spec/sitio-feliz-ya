import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus,
  Search,
  Eye,
  FileText,
  Send,
  ShoppingCart,
  MoreVertical,
  Loader2,
  RefreshCw,
  Trash2,
  Pencil,
  Printer,
  CheckCircle,
  Clock,
  SendHorizontal,
  X,
} from "lucide-react";
import { format, isBefore } from "date-fns";
import { es } from "date-fns/locale";
import CrearCotizacionDialog from "./CrearCotizacionDialog";
import CotizacionDetalleDialog from "./CotizacionDetalleDialog";
import EnviarCotizacionDialog from "./EnviarCotizacionDialog";
import EnviarCotizacionesAgrupadasDialog from "./EnviarCotizacionesAgrupadasDialog";
import ImprimirCotizacionDialog from "./ImprimirCotizacionDialog";
import AutorizacionCotizacionDialog from "./AutorizacionCotizacionDialog";
import { formatCurrency } from "@/lib/utils";
import { useUserRoles } from "@/hooks/useUserRoles";

interface Cotizacion {
  id: string;
  folio: string;
  nombre: string | null;
  cliente_id: string;
  cliente: { nombre: string; codigo: string };
  sucursal: { nombre: string } | null;
  fecha_creacion: string;
  fecha_vigencia: string;
  status: string;
  total: number;
  creado_por?: string;
  notas?: string;
  tipo_cotizacion?: string;
  mes_vigencia?: string;
}

const CotizacionesTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, isLoading: rolesLoading } = useUserRoles();
  const [searchTerm, setSearchTerm] = useState("");
  const [crearOpen, setCrearOpen] = useState(false);
  const [editCotizacionId, setEditCotizacionId] = useState<string | null>(null);
  const [selectedCotizacion, setSelectedCotizacion] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cotizacionToDelete, setCotizacionToDelete] = useState<Cotizacion | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [enviarCotizacion, setEnviarCotizacion] = useState<Cotizacion | null>(null);
  const [imprimirCotizacionId, setImprimirCotizacionId] = useState<string | null>(null);
  const [autorizarCotizacion, setAutorizarCotizacion] = useState<any>(null);
  const [sendingToAuth, setSendingToAuth] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [enviarMultiplesOpen, setEnviarMultiplesOpen] = useState(false);

  const { data: cotizaciones, isLoading, refetch } = useQuery({
    queryKey: ["cotizaciones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cotizaciones")
        .select(`
          id,
          folio,
          nombre,
          cliente_id,
          cliente:clientes(nombre, codigo),
          sucursal:cliente_sucursales(nombre),
          fecha_creacion,
          fecha_vigencia,
          status,
          total,
          creado_por,
          notas,
          tipo_cotizacion,
          mes_vigencia
        `)
        .order("fecha_creacion", { ascending: false });

      if (error) throw error;
      return data as unknown as Cotizacion[];
    },
  });

  const getTipoBadge = (tipo: string | undefined) => {
    if (!tipo || tipo === 'general') return null;
    const badges: Record<string, { icon: string; label: string; className: string }> = {
      avio: { icon: '🍞', label: 'Avío', className: 'bg-yellow-500/20 text-yellow-700' },
      azucar: { icon: '🍬', label: 'Azúcar', className: 'bg-blue-500/20 text-blue-700' },
      rosticeria: { icon: '🍗', label: 'Rosticería', className: 'bg-orange-500/20 text-orange-700' },
    };
    const badge = badges[tipo];
    if (!badge) return null;
    return (
      <Badge className={badge.className}>
        {badge.icon} {badge.label}
      </Badge>
    );
  };

  const getStatusBadge = (status: string, fechaVigencia: string) => {
    const hoy = new Date();
    const vigencia = new Date(fechaVigencia);

    if (status === "aceptada") {
      return <Badge className="bg-green-500/20 text-green-700">Aceptada</Badge>;
    }
    if (status === "rechazada") {
      return <Badge variant="destructive">Rechazada</Badge>;
    }
    if (status === "pendiente_autorizacion") {
      return <Badge className="bg-amber-500/20 text-amber-700 flex items-center gap-1">
        <Clock className="h-3 w-3" />
        Pendiente autorización
      </Badge>;
    }
    if (status === "autorizada") {
      return <Badge className="bg-green-500/20 text-green-700 flex items-center gap-1">
        <CheckCircle className="h-3 w-3" />
        Autorizada
      </Badge>;
    }
    if (status === "enviada" && isBefore(vigencia, hoy)) {
      return <Badge className="bg-red-500/20 text-red-700">Vencida</Badge>;
    }
    if (status === "enviada") {
      return <Badge className="bg-blue-500/20 text-blue-700">Enviada</Badge>;
    }
    return <Badge variant="secondary">Borrador</Badge>;
  };

  const filteredCotizaciones = cotizaciones?.filter(
    (c) =>
      c.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.cliente.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.nombre && c.nombre.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleConvertirPedido = async (cotizacionId: string) => {
    toast({
      title: "Próximamente",
      description: "La conversión a pedido estará disponible pronto",
    });
  };

  // Send quotation for authorization (non-admin flow)
  const handleEnviarAAutorizacion = async (cotizacion: Cotizacion) => {
    setSendingToAuth(cotizacion.id);
    try {
      // Update status to pending authorization
      const { error: updateError } = await supabase
        .from("cotizaciones")
        .update({ status: "pendiente_autorizacion" })
        .eq("id", cotizacion.id);

      if (updateError) throw updateError;

      // Create notification for admin
      await supabase
        .from("notificaciones")
        .insert({
          tipo: "autorizacion_cotizacion",
          titulo: `Cotización ${cotizacion.folio} pendiente de autorización`,
          descripcion: `Nueva cotización para ${cotizacion.cliente.nombre} requiere autorización antes de enviar.`,
          cotizacion_id: cotizacion.id,
          leida: false,
        });

      toast({
        title: "Enviada a autorización",
        description: `La cotización ${cotizacion.folio} fue enviada para aprobación del administrador.`,
      });

      queryClient.invalidateQueries({ queryKey: ["cotizaciones"] });
      queryClient.invalidateQueries({ queryKey: ["notificaciones"] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSendingToAuth(null);
    }
  };

  // Admin can directly authorize a borrador
  const handleAutorizarDirecto = async (cotizacion: Cotizacion) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user) throw new Error("No hay sesión activa");

      const { error } = await supabase
        .from("cotizaciones")
        .update({
          status: "autorizada",
          autorizado_por: session.session.user.id,
          fecha_autorizacion: new Date().toISOString(),
        })
        .eq("id", cotizacion.id);

      if (error) throw error;

      toast({
        title: "Cotización autorizada",
        description: `${cotizacion.folio} está lista para enviar al cliente.`,
      });

      queryClient.invalidateQueries({ queryKey: ["cotizaciones"] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteClick = (cotizacion: Cotizacion) => {
    setCotizacionToDelete(cotizacion);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!cotizacionToDelete) return;

    setDeleting(true);
    try {
      // First delete details
      const { error: detallesError } = await supabase
        .from("cotizaciones_detalles")
        .delete()
        .eq("cotizacion_id", cotizacionToDelete.id);

      if (detallesError) throw detallesError;

      // Then delete the cotizacion
      const { error } = await supabase
        .from("cotizaciones")
        .delete()
        .eq("id", cotizacionToDelete.id);

      if (error) throw error;

      toast({
        title: "Cotización eliminada",
        description: `La cotización ${cotizacionToDelete.folio} ha sido eliminada`,
      });

      queryClient.invalidateQueries({ queryKey: ["cotizaciones"] });
    } catch (error: any) {
      toast({
        title: "Error al eliminar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setCotizacionToDelete(null);
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por folio o cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => setCrearOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Cotización
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Cotizaciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={
                          filteredCotizaciones?.length > 0 &&
                          filteredCotizaciones?.filter(c => c.status === "autorizada" || c.status === "enviada").every(c => selectedIds.includes(c.id))
                        }
                        onCheckedChange={(checked) => {
                          if (checked) {
                            const sendableIds = filteredCotizaciones?.filter(c => c.status === "autorizada" || c.status === "enviada").map(c => c.id) || [];
                            setSelectedIds(sendableIds);
                          } else {
                            setSelectedIds([]);
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Folio</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Vigencia</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCotizaciones?.map((c) => (
                    <TableRow key={c.id} className={selectedIds.includes(c.id) ? "bg-muted/50" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(c.id)}
                          disabled={c.status !== "autorizada" && c.status !== "enviada"}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedIds(prev => [...prev, c.id]);
                            } else {
                              setSelectedIds(prev => prev.filter(id => id !== c.id));
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-mono font-medium">
                        {c.folio}
                      </TableCell>
                      <TableCell className="font-medium text-primary">
                        {c.nombre || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>
                        {getTipoBadge(c.tipo_cotizacion)}
                        {c.mes_vigencia && (
                          <span className="text-xs text-muted-foreground ml-1">
                            {format(new Date(c.mes_vigencia + "-01"), "MMM yyyy", { locale: es })}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{c.cliente.nombre}</TableCell>
                      <TableCell>
                        {format(new Date(c.fecha_vigencia), "dd/MM/yyyy", {
                          locale: es,
                        })}
                      </TableCell>
                      <TableCell className="font-medium font-mono">
                        {c.total === 0 || c.notas?.includes('[Solo precios]') ? (
                          <span className="text-muted-foreground text-sm">Solo precios</span>
                        ) : (
                          `$${formatCurrency(c.total)}`
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(c.status, c.fecha_vigencia)}
                      </TableCell>
                      <TableCell>
                        {c.status === "autorizada" && (
                          <Button 
                            size="sm" 
                            onClick={() => setEnviarCotizacion(c)}
                            className="gap-1"
                          >
                            <Send className="h-3.5 w-3.5" />
                            Enviar
                          </Button>
                        )}
                        {c.status === "enviada" && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setEnviarCotizacion(c)}
                            className="gap-1"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Reenviar
                          </Button>
                        )}
                        {!rolesLoading && isAdmin && c.status === "pendiente_autorizacion" && (
                          <Button 
                            size="sm" 
                            variant="secondary"
                            onClick={() => setAutorizarCotizacion(c)}
                            className="gap-1"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            Autorizar
                          </Button>
                        )}
                        {(c.status === "borrador" && !rolesLoading && isAdmin) && (
                          <Button 
                            size="sm" 
                            variant="secondary"
                            onClick={() => handleAutorizarDirecto(c)}
                            className="gap-1"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            Autorizar
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={sendingToAuth === c.id}>
                              {sendingToAuth === c.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreVertical className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setSelectedCotizacion(c.id)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Ver detalle
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setImprimirCotizacionId(c.id)}
                            >
                              <Printer className="h-4 w-4 mr-2" />
                              Ver / Imprimir
                            </DropdownMenuItem>
                            
                            {/* Edit option for borrador, pendiente_autorizacion, autorizada, or enviada */}
                            {(c.status === "borrador" || c.status === "pendiente_autorizacion" || c.status === "autorizada" || c.status === "enviada") && (
                              <DropdownMenuItem
                                onClick={() => setEditCotizacionId(c.id)}
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                            )}
                            
                            {/* Borrador: Non-admin sends to authorization, Admin can authorize directly */}
                            {c.status === "borrador" && !rolesLoading && !isAdmin && (
                              <DropdownMenuItem
                                onClick={() => handleEnviarAAutorizacion(c)}
                                className="text-amber-600"
                              >
                                <SendHorizontal className="h-4 w-4 mr-2" />
                                Enviar a autorización
                              </DropdownMenuItem>
                            )}
                            
                            {c.status === "borrador" && !rolesLoading && isAdmin && (
                              <DropdownMenuItem
                                onClick={() => handleAutorizarDirecto(c)}
                                className="text-green-600"
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Autorizar
                              </DropdownMenuItem>
                            )}
                            
                            {/* Admin can authorize/reject pending quotations */}
                            {!rolesLoading && isAdmin && c.status === "pendiente_autorizacion" && (
                              <DropdownMenuItem
                                onClick={() => setAutorizarCotizacion(c)}
                                className="text-amber-600"
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Revisar y autorizar
                              </DropdownMenuItem>
                            )}
                            
                            {/* Send option only for authorized quotations */}
                            {c.status === "autorizada" && (
                              <DropdownMenuItem
                                onClick={() => setEnviarCotizacion(c)}
                              >
                                <Send className="h-4 w-4 mr-2" />
                                Enviar al cliente
                              </DropdownMenuItem>
                            )}
                            
                            {/* Resend option for already sent quotations */}
                            {c.status === "enviada" && (
                              <DropdownMenuItem
                                onClick={() => setEnviarCotizacion(c)}
                              >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Reenviar al cliente
                              </DropdownMenuItem>
                            )}
                            
                            {(c.status === "enviada" || c.status === "aceptada") && (
                              <DropdownMenuItem
                                onClick={() => handleConvertirPedido(c.id)}
                              >
                                <ShoppingCart className="h-4 w-4 mr-2" />
                                Convertir a pedido
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDeleteClick(c)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredCotizaciones?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-12">
                        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">
                          No hay cotizaciones registradas
                        </p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Floating action bar for bulk selection */}
        {selectedIds.length > 0 && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-background border rounded-lg shadow-lg p-3 flex items-center gap-4 z-50">
            <span className="text-sm font-medium">
              {selectedIds.length} cotización(es) seleccionada(s)
            </span>
            <Button
              size="sm"
              onClick={() => setEnviarMultiplesOpen(true)}
            >
              <Send className="h-4 w-4 mr-2" />
              Enviar seleccionadas
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds([])}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <CrearCotizacionDialog
        open={crearOpen || !!editCotizacionId}
        onOpenChange={(open) => {
          if (!open) {
            setCrearOpen(false);
            setEditCotizacionId(null);
          }
        }}
        cotizacionId={editCotizacionId || undefined}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["cotizaciones"] });
        }}
      />

      {selectedCotizacion && (
        <CotizacionDetalleDialog
          cotizacionId={selectedCotizacion}
          open={!!selectedCotizacion}
          onOpenChange={(open) => !open && setSelectedCotizacion(null)}
          onUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ["cotizaciones"] });
          }}
        />
      )}

      {/* Enviar Cotización Dialog */}
      {enviarCotizacion && (
        <EnviarCotizacionDialog
          open={!!enviarCotizacion}
          onOpenChange={(open) => !open && setEnviarCotizacion(null)}
          cotizacionId={enviarCotizacion.id}
          clienteId={enviarCotizacion.cliente_id}
          clienteNombre={enviarCotizacion.cliente.nombre}
          folio={enviarCotizacion.folio}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["cotizaciones"] });
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cotización?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la cotización <strong>{cotizacionToDelete?.folio}</strong> de forma permanente. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                "Eliminar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Imprimir Cotización Dialog */}
      {imprimirCotizacionId && (
        <ImprimirCotizacionDialog
          cotizacionId={imprimirCotizacionId}
          open={!!imprimirCotizacionId}
          onOpenChange={(open) => !open && setImprimirCotizacionId(null)}
        />
      )}

      {/* Autorización Cotización Dialog */}
      {autorizarCotizacion && (
        <AutorizacionCotizacionDialog
          open={!!autorizarCotizacion}
          onOpenChange={(open) => {
            if (!open) setAutorizarCotizacion(null);
          }}
          cotizacion={autorizarCotizacion}
        />
      )}

      {/* Enviar Cotizaciones Agrupadas Dialog */}
      <EnviarCotizacionesAgrupadasDialog
        open={enviarMultiplesOpen}
        onOpenChange={(open) => {
          setEnviarMultiplesOpen(open);
          if (!open) setSelectedIds([]);
        }}
        cotizaciones={filteredCotizaciones?.filter(c => selectedIds.includes(c.id)) || []}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["cotizaciones"] });
          setSelectedIds([]);
        }}
      />
    </>
  );
};

export default CotizacionesTab;
