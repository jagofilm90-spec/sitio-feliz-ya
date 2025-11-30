import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
} from "lucide-react";
import { format, isBefore } from "date-fns";
import { es } from "date-fns/locale";
import CrearCotizacionDialog from "./CrearCotizacionDialog";
import CotizacionDetalleDialog from "./CotizacionDetalleDialog";
import EnviarCotizacionDialog from "./EnviarCotizacionDialog";
import ImprimirCotizacionDialog from "./ImprimirCotizacionDialog";
import { formatCurrency } from "@/lib/utils";

interface Cotizacion {
  id: string;
  folio: string;
  cliente_id: string;
  cliente: { nombre: string; codigo: string };
  sucursal: { nombre: string } | null;
  fecha_creacion: string;
  fecha_vigencia: string;
  status: string;
  total: number;
}

const CotizacionesTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [crearOpen, setCrearOpen] = useState(false);
  const [editCotizacionId, setEditCotizacionId] = useState<string | null>(null);
  const [selectedCotizacion, setSelectedCotizacion] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cotizacionToDelete, setCotizacionToDelete] = useState<Cotizacion | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [enviarCotizacion, setEnviarCotizacion] = useState<Cotizacion | null>(null);
  const [imprimirCotizacionId, setImprimirCotizacionId] = useState<string | null>(null);

  const { data: cotizaciones, isLoading, refetch } = useQuery({
    queryKey: ["cotizaciones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cotizaciones")
        .select(`
          id,
          folio,
          cliente_id,
          cliente:clientes(nombre, codigo),
          sucursal:cliente_sucursales(nombre),
          fecha_creacion,
          fecha_vigencia,
          status,
          total
        `)
        .order("fecha_creacion", { ascending: false });

      if (error) throw error;
      return data as unknown as Cotizacion[];
    },
  });

  const getStatusBadge = (status: string, fechaVigencia: string) => {
    const hoy = new Date();
    const vigencia = new Date(fechaVigencia);

    if (status === "aceptada") {
      return <Badge className="bg-green-500/20 text-green-700">Aceptada</Badge>;
    }
    if (status === "rechazada") {
      return <Badge variant="destructive">Rechazada</Badge>;
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
      c.cliente.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleConvertirPedido = async (cotizacionId: string) => {
    toast({
      title: "Próximamente",
      description: "La conversión a pedido estará disponible pronto",
    });
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
                    <TableHead>Folio</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Sucursal</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Vigencia</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCotizaciones?.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono font-medium">
                        {c.folio}
                      </TableCell>
                      <TableCell>{c.cliente.nombre}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.sucursal?.nombre || "-"}
                      </TableCell>
                      <TableCell>
                        {format(new Date(c.fecha_creacion), "dd/MM/yyyy", {
                          locale: es,
                        })}
                      </TableCell>
                      <TableCell>
                        {format(new Date(c.fecha_vigencia), "dd/MM/yyyy", {
                          locale: es,
                        })}
                      </TableCell>
                      <TableCell className="font-medium font-mono">
                        ${formatCurrency(c.total)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(c.status, c.fecha_vigencia)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
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
                            {c.status === "borrador" && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => setEditCotizacionId(c.id)}
                                >
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setEnviarCotizacion(c)}
                                >
                                  <Send className="h-4 w-4 mr-2" />
                                  Enviar al cliente
                                </DropdownMenuItem>
                              </>
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
                      <TableCell colSpan={8} className="text-center py-12">
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
    </>
  );
};

export default CotizacionesTab;
