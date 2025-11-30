import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Search, Printer, FileText, Eye } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ImprimirRemisionDialog } from "@/components/remisiones/ImprimirRemisionDialog";

const Remisiones = () => {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [remisionDialogOpen, setRemisionDialogOpen] = useState(false);
  const [selectedPedidoData, setSelectedPedidoData] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadPedidos();
  }, []);

  const loadPedidos = async () => {
    try {
      const { data, error } = await supabase
        .from("pedidos")
        .select(`
          *,
          clientes (
            id,
            nombre,
            codigo,
            rfc,
            direccion,
            telefono,
            termino_credito
          ),
          cliente_sucursales (
            id,
            nombre,
            direccion
          ),
          profiles:vendedor_id (
            full_name
          ),
          pedidos_detalles (
            id,
            cantidad,
            precio_unitario,
            subtotal,
            productos (
              id,
              codigo,
              nombre,
              marca,
              presentacion,
              unidad,
              aplica_iva
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPedidos(data || []);
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

  const getCreditLabel = (term: string) => {
    const labels: Record<string, string> = {
      contado: "Contado",
      "8_dias": "8 días",
      "15_dias": "15 días",
      "30_dias": "30 días",
    };
    return labels[term] || term;
  };

  const handlePrintRemision = async (pedido: any) => {
    // Preparar datos para la remisión
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

    // Calcular IVA (solo de productos que aplican IVA)
    let subtotalConIva = 0;
    let subtotalSinIva = 0;
    
    pedido.pedidos_detalles.forEach((detalle: any) => {
      if (detalle.productos?.aplica_iva) {
        subtotalConIva += detalle.subtotal;
      } else {
        subtotalSinIva += detalle.subtotal;
      }
    });

    // Si el precio incluye IVA, desegregamos
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
  };

  const filteredPedidos = pedidos.filter((p) =>
    p.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.clientes?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.clientes?.codigo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pendiente: "secondary",
      en_ruta: "default",
      entregado: "outline",
      cancelado: "destructive",
    };
    const labels: Record<string, string> = {
      pendiente: "Pendiente",
      en_ruta: "En Ruta",
      entregado: "Entregado",
      cancelado: "Cancelado",
    };
    return <Badge variant={variants[status] || "secondary"}>{labels[status] || status}</Badge>;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FileText className="h-8 w-8" />
              Remisiones / Notas de Venta
            </h1>
            <p className="text-muted-foreground">
              Genera e imprime remisiones para pedidos sin factura
            </p>
          </div>
        </div>

        <div className="flex gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por folio, cliente o código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Folio Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Sucursal</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Cargando pedidos...
                  </TableCell>
                </TableRow>
              ) : filteredPedidos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No se encontraron pedidos
                  </TableCell>
                </TableRow>
              ) : (
                filteredPedidos.map((pedido) => (
                  <TableRow key={pedido.id}>
                    <TableCell className="font-medium">{pedido.folio}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{pedido.clientes?.nombre}</p>
                        <p className="text-xs text-muted-foreground">{pedido.clientes?.codigo}</p>
                      </div>
                    </TableCell>
                    <TableCell>{pedido.cliente_sucursales?.nombre || '-'}</TableCell>
                    <TableCell>
                      {format(new Date(pedido.fecha_pedido), "dd/MM/yyyy", { locale: es })}
                    </TableCell>
                    <TableCell className="font-medium">
                      ${pedido.total?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>{getStatusBadge(pedido.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePrintRemision(pedido)}
                        className="gap-2"
                      >
                        <Printer className="h-4 w-4" />
                        Imprimir Remisión
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <ImprimirRemisionDialog
          open={remisionDialogOpen}
          onOpenChange={setRemisionDialogOpen}
          datos={selectedPedidoData}
        />
      </div>
    </Layout>
  );
};

export default Remisiones;
