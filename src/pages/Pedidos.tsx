import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Eye, ShoppingCart, FileText, Link2, Printer, Receipt, Send, CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import CotizacionesTab from "@/components/cotizaciones/CotizacionesTab";
import CotizacionDetalleDialog from "@/components/cotizaciones/CotizacionDetalleDialog";
import { ImprimirRemisionDialog } from "@/components/remisiones/ImprimirRemisionDialog";
import EditarEmailClienteDialog from "@/components/pedidos/EditarEmailClienteDialog";
import { formatCurrency } from "@/lib/utils";

interface PedidoConCotizacion {
  id: string;
  folio: string;
  fecha_pedido: string;
  total: number;
  status: string;
  requiere_factura: boolean;
  facturado: boolean;
  factura_enviada_al_cliente: boolean;
  clientes: { id: string; nombre: string; email: string | null } | null;
  profiles: { full_name: string } | null;
  cotizacion_origen?: { id: string; folio: string } | null;
  sucursal?: { email_facturacion: string | null } | null;
}

const Pedidos = () => {
  const [pedidos, setPedidos] = useState<PedidoConCotizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("pedidos");
  const [selectedCotizacionId, setSelectedCotizacionId] = useState<string | null>(null);
  const [remisionDialogOpen, setRemisionDialogOpen] = useState(false);
  const [selectedPedidoData, setSelectedPedidoData] = useState<any>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedPedidoForEmail, setSelectedPedidoForEmail] = useState<PedidoConCotizacion | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadPedidos();
  }, []);

  const loadPedidos = async () => {
    try {
      // First get pedidos
      const { data: pedidosData, error: pedidosError } = await supabase
        .from("pedidos")
        .select(`
          id,
          folio,
          fecha_pedido,
          total,
          status,
          requiere_factura,
          facturado,
          factura_enviada_al_cliente,
          sucursal_id,
          clientes (id, nombre, email),
          profiles:vendedor_id (full_name),
          cliente_sucursales:sucursal_id (email_facturacion)
        `)
        .order("fecha_pedido", { ascending: false });

      if (pedidosError) throw pedidosError;

      // Get cotizaciones that have pedido_id (created from cotizacion)
      const { data: cotizacionesData, error: cotizacionesError } = await supabase
        .from("cotizaciones")
        .select("id, folio, pedido_id")
        .not("pedido_id", "is", null);

      if (cotizacionesError) throw cotizacionesError;

      // Create map of pedido_id to cotizacion
      const cotizacionMap = new Map<string, { id: string; folio: string }>();
      cotizacionesData?.forEach((cot) => {
        if (cot.pedido_id) {
          cotizacionMap.set(cot.pedido_id, { id: cot.id, folio: cot.folio });
        }
      });

      // Merge data
      const pedidosConCotizacion: PedidoConCotizacion[] = (pedidosData || []).map((p: any) => ({
        ...p,
        cotizacion_origen: cotizacionMap.get(p.id) || null,
        sucursal: p.cliente_sucursales,
      }));

      setPedidos(pedidosConCotizacion);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los pedidos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredPedidos = pedidos.filter(
    (p) =>
      p.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.clientes?.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.cotizacion_origen?.folio.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pendiente: "secondary",
      en_ruta: "default",
      entregado: "default",
      cancelado: "destructive",
    };

    const labels: Record<string, string> = {
      pendiente: "Pendiente",
      en_ruta: "En Ruta",
      entregado: "Entregado",
      cancelado: "Cancelado",
    };

    return (
      <Badge variant={variants[status] || "default"}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getFacturaBadge = (pedido: PedidoConCotizacion) => {
    if (pedido.factura_enviada_al_cliente) {
      return (
        <Badge variant="default" className="gap-1 bg-green-600">
          <CheckCircle2 className="h-3 w-3" />
          Enviada
        </Badge>
      );
    }
    if (pedido.facturado) {
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" />
          Por enviar
        </Badge>
      );
    }
    if (pedido.requiere_factura) {
      return (
        <Badge variant="outline" className="gap-1">
          <FileText className="h-3 w-3" />
          Pendiente
        </Badge>
      );
    }
    return (
      <span className="text-muted-foreground text-xs">Remisión</span>
    );
  };

  const getCreditLabel = (term: string) => {
    const labels: Record<string, string> = {
      contado: "Contado",
      "8_dias": "8 días",
      "15_dias": "15 días",
      "30_dias": "30 días",
    };
    return labels[term] || term;
  };

  const handleFacturarPedido = async (pedidoId: string) => {
    try {
      const { error } = await supabase
        .from("pedidos")
        .update({ facturado: true })
        .eq("id", pedidoId);

      if (error) throw error;

      toast({ title: "Pedido marcado como facturado" });
      loadPedidos();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudo facturar el pedido",
        variant: "destructive",
      });
    }
  };

  const getEmailForPedido = (pedido: PedidoConCotizacion): string | null => {
    // First check sucursal email_facturacion
    if (pedido.sucursal?.email_facturacion) {
      return pedido.sucursal.email_facturacion;
    }
    // Fall back to client email
    if (pedido.clientes?.email) {
      return pedido.clientes.email;
    }
    return null;
  };

  const handleEnviarFactura = async (pedido: PedidoConCotizacion) => {
    const email = getEmailForPedido(pedido);
    
    if (!email) {
      setSelectedPedidoForEmail(pedido);
      setEmailDialogOpen(true);
      return;
    }

    try {
      // Call edge function to send email
      const { data, error } = await supabase.functions.invoke('send-invoice-email', {
        body: {
          pedidoId: pedido.id,
          clienteEmail: email,
          clienteNombre: pedido.clientes?.nombre || 'Cliente',
          pedidoFolio: pedido.folio,
          total: pedido.total,
          fechaPedido: pedido.fecha_pedido,
        }
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Error al enviar factura');
      }

      toast({ 
        title: "Factura enviada",
        description: `Se envió la factura a ${email}`,
      });
      loadPedidos();
    } catch (error: any) {
      console.error('Error sending invoice:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo enviar la factura",
        variant: "destructive",
      });
    }
  };

  const handlePrintRemision = async (pedidoId: string) => {
    try {
      // Fetch full pedido data
      const { data: pedido, error } = await supabase
        .from("pedidos")
        .select(`
          *,
          clientes (
            id, nombre, codigo, rfc, direccion, telefono, termino_credito
          ),
          cliente_sucursales (
            id, nombre, direccion
          ),
          profiles:vendedor_id (
            full_name
          ),
          pedidos_detalles (
            id, cantidad, precio_unitario, subtotal,
            productos (
              id, codigo, nombre, marca, presentacion, unidad, aplica_iva
            )
          )
        `)
        .eq("id", pedidoId)
        .single();

      if (error) throw error;

      // Prepare data for remision
      const productos = pedido.pedidos_detalles.map((detalle: any) => {
        const producto = detalle.productos;
        const descripcion = `${producto.nombre}${producto.marca ? ` ${producto.marca}` : ''}${producto.presentacion ? ` (${producto.presentacion}KG)` : ''}`;
        
        return {
          cantidad: detalle.cantidad,
          unidad: producto.unidad || 'pza',
          descripcion,
          precio_unitario: detalle.precio_unitario,
          total: detalle.subtotal,
        };
      });

      let subtotalConIva = 0;
      let subtotalSinIva = 0;
      
      pedido.pedidos_detalles.forEach((detalle: any) => {
        if (detalle.productos?.aplica_iva) {
          subtotalConIva += detalle.subtotal;
        } else {
          subtotalSinIva += detalle.subtotal;
        }
      });

      const baseConIva = subtotalConIva / 1.16;
      const ivaCalculado = subtotalConIva - baseConIva;
      const subtotalReal = baseConIva + subtotalSinIva;

      const datosRemision = {
        folio: `REM-${pedido.folio}`,
        fecha: pedido.fecha_pedido,
        cliente: {
          nombre: pedido.clientes?.nombre || 'Sin nombre',
          rfc: pedido.clientes?.rfc,
          direccion_fiscal: pedido.clientes?.direccion,
          telefono: pedido.clientes?.telefono,
        },
        sucursal: pedido.cliente_sucursales ? {
          nombre: pedido.cliente_sucursales.nombre,
          direccion: pedido.cliente_sucursales.direccion,
        } : undefined,
        productos,
        subtotal: subtotalReal,
        iva: ivaCalculado,
        total: pedido.total || (subtotalReal + ivaCalculado),
        condiciones_credito: getCreditLabel(pedido.clientes?.termino_credito || 'contado'),
        vendedor: pedido.profiles?.full_name,
        notas: pedido.notas,
      };

      setSelectedPedidoData(datosRemision);
      setRemisionDialogOpen(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudo cargar el pedido para imprimir",
        variant: "destructive",
      });
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Pedidos y Cotizaciones</h1>
          <p className="text-muted-foreground">
            Gestión de pedidos de clientes y cotizaciones
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="pedidos" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              Pedidos
            </TabsTrigger>
            <TabsTrigger value="cotizaciones" className="gap-2">
              <FileText className="h-4 w-4" />
              Cotizaciones
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pedidos" className="mt-6 space-y-4">
            <div className="flex justify-between items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por folio o cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Pedido
              </Button>
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Folio</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Factura</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center">
                        Cargando...
                      </TableCell>
                    </TableRow>
                  ) : filteredPedidos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center">
                        No hay pedidos registrados
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPedidos.map((pedido) => (
                      <TableRow key={pedido.id}>
                        <TableCell className="font-medium font-mono">{pedido.folio}</TableCell>
                        <TableCell>{pedido.clientes?.nombre || "—"}</TableCell>
                        <TableCell>{pedido.profiles?.full_name || "—"}</TableCell>
                        <TableCell>
                          {new Date(pedido.fecha_pedido).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="font-mono">${formatCurrency(pedido.total)}</TableCell>
                        <TableCell>{getStatusBadge(pedido.status)}</TableCell>
                        <TableCell>{getFacturaBadge(pedido)}</TableCell>
                        <TableCell>
                          {pedido.cotizacion_origen ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="gap-1 text-primary hover:text-primary/80 p-1 h-auto"
                                    onClick={() => setSelectedCotizacionId(pedido.cotizacion_origen!.id)}
                                  >
                                    <Link2 className="h-3 w-3" />
                                    <span className="font-mono text-xs">{pedido.cotizacion_origen.folio}</span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Ver cotización origen</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="text-muted-foreground text-xs">Directo</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Ver detalles</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => handlePrintRemision(pedido.id)}
                                  >
                                    <Printer className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Imprimir Remisión</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            
                            {/* Facturar Pedido - Only show if not facturado */}
                            {!pedido.facturado && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      onClick={() => handleFacturarPedido(pedido.id)}
                                    >
                                      <Receipt className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Facturar Pedido</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            
                            {/* Enviar Factura - Only show if facturado but not sent */}
                            {pedido.facturado && !pedido.factura_enviada_al_cliente && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      onClick={() => handleEnviarFactura(pedido)}
                                    >
                                      <Send className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Enviar Factura al Cliente</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="cotizaciones" className="mt-6">
            <CotizacionesTab />
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog para ver cotización origen */}
      {selectedCotizacionId && (
        <CotizacionDetalleDialog
          cotizacionId={selectedCotizacionId}
          open={!!selectedCotizacionId}
          onOpenChange={(open) => !open && setSelectedCotizacionId(null)}
          onUpdate={() => loadPedidos()}
        />
      )}

      {/* Dialog para imprimir remisión */}
      <ImprimirRemisionDialog
        open={remisionDialogOpen}
        onOpenChange={setRemisionDialogOpen}
        datos={selectedPedidoData}
      />

      {/* Dialog para agregar email de cliente */}
      {selectedPedidoForEmail && (
        <EditarEmailClienteDialog
          open={emailDialogOpen}
          onOpenChange={setEmailDialogOpen}
          clienteId={selectedPedidoForEmail.clientes?.id || ""}
          clienteNombre={selectedPedidoForEmail.clientes?.nombre || "Sin nombre"}
          sucursalId={selectedPedidoForEmail.sucursal ? undefined : undefined}
          onEmailUpdated={() => {
            loadPedidos();
            setSelectedPedidoForEmail(null);
          }}
        />
      )}
    </Layout>
  );
};

export default Pedidos;