import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, ShoppingCart, Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ClienteNuevoPedidoProps {
  clienteId: string;
  limiteCredito: number;
  saldoPendiente: number;
}

interface DetalleProducto {
  productoId: string;
  nombre: string;
  codigo: string;
  unidad: string;
  precioUnitario: number;
  cantidad: number;
  subtotal: number;
}

const ClienteNuevoPedido = ({ clienteId, limiteCredito, saldoPendiente }: ClienteNuevoPedidoProps) => {
  const [productos, setProductos] = useState<any[]>([]);
  const [detalles, setDetalles] = useState<DetalleProducto[]>([]);
  const [notas, setNotas] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    loadProductos();
  }, []);

  const loadProductos = async () => {
    try {
      const { data, error } = await supabase
        .from("productos")
        .select("*")
        .eq("activo", true)
        .gt("stock_actual", 0)
        .order("nombre");

      if (error) throw error;
      setProductos(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los productos",
        variant: "destructive",
      });
    }
  };

  const productosFiltrados = productos.filter(
    (p) =>
      p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.codigo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const agregarProducto = (producto: any) => {
    const existe = detalles.find((d) => d.productoId === producto.id);
    
    if (existe) {
      toast({
        title: "Producto ya agregado",
        description: "Modifica la cantidad en la tabla",
        variant: "destructive",
      });
      return;
    }

    const nuevoDetalle: DetalleProducto = {
      productoId: producto.id,
      nombre: producto.nombre,
      codigo: producto.codigo,
      unidad: producto.unidad,
      precioUnitario: producto.precio_venta,
      cantidad: 1,
      subtotal: producto.precio_venta,
    };

    setDetalles([...detalles, nuevoDetalle]);
    setSearchTerm("");
  };

  const actualizarCantidad = (productoId: string, cantidad: number) => {
    if (cantidad <= 0) return;

    setDetalles(
      detalles.map((d) =>
        d.productoId === productoId
          ? { ...d, cantidad, subtotal: d.precioUnitario * cantidad }
          : d
      )
    );
  };

  const eliminarProducto = (productoId: string) => {
    setDetalles(detalles.filter((d) => d.productoId !== productoId));
  };

  const calcularTotales = () => {
    const subtotal = detalles.reduce((sum, d) => sum + d.subtotal, 0);
    const impuestos = subtotal * 0.16; // 16% IVA
    const total = subtotal + impuestos;
    return { subtotal, impuestos, total };
  };

  const validarCredito = () => {
    const { total } = calcularTotales();
    const creditoDisponible = limiteCredito - saldoPendiente;
    
    if (total > creditoDisponible) {
      toast({
        title: "Crédito insuficiente",
        description: `Tu crédito disponible es $${creditoDisponible.toFixed(2)}`,
        variant: "destructive",
      });
      return false;
    }
    
    return true;
  };

  const crearPedido = async () => {
    if (detalles.length === 0) {
      toast({
        title: "Pedido vacío",
        description: "Agrega al menos un producto al pedido",
        variant: "destructive",
      });
      return;
    }

    if (!validarCredito()) return;

    setLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Usuario no autenticado");

      const { subtotal, impuestos, total } = calcularTotales();
      
      // Generar folio único
      const timestamp = Date.now().toString().slice(-6);
      const folio = `PED-CLI-${timestamp}`;

      // Crear pedido (sin vendedor_id ya que es del cliente)
      const { data: pedido, error: pedidoError } = await supabase
        .from("pedidos")
        .insert({
          folio,
          cliente_id: clienteId,
          vendedor_id: user.user.id, // Temporal - necesitaría ajustarse
          fecha_pedido: new Date().toISOString(),
          subtotal,
          impuestos,
          total,
          status: "pendiente",
          notas: notas || null,
        })
        .select()
        .single();

      if (pedidoError) throw pedidoError;

      // Crear detalles
      const detallesInsert = detalles.map((d) => ({
        pedido_id: pedido.id,
        producto_id: d.productoId,
        cantidad: d.cantidad,
        precio_unitario: d.precioUnitario,
        subtotal: d.subtotal,
      }));

      const { error: detallesError } = await supabase
        .from("pedidos_detalles")
        .insert(detallesInsert);

      if (detallesError) throw detallesError;

      toast({
        title: "Pedido creado",
        description: `Tu pedido ${folio} ha sido creado exitosamente`,
      });

      // Limpiar formulario
      setDetalles([]);
      setNotas("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudo crear el pedido: " + error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, impuestos, total } = calcularTotales();
  const creditoDisponible = limiteCredito - saldoPendiente;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Nuevo Pedido</CardTitle>
          <CardDescription>
            Crédito disponible: ${creditoDisponible.toFixed(2)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Buscar Producto</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            {searchTerm && productosFiltrados.length > 0 && (
              <div className="border rounded-lg max-h-60 overflow-y-auto">
                {productosFiltrados.map((producto) => (
                  <div
                    key={producto.id}
                    className="p-3 hover:bg-muted cursor-pointer flex justify-between items-center"
                    onClick={() => agregarProducto(producto)}
                  >
                    <div>
                      <p className="font-medium">{producto.nombre}</p>
                      <p className="text-sm text-muted-foreground">
                        {producto.codigo} - Stock: {producto.stock_actual} {producto.unidad}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${producto.precio_venta.toFixed(2)}</p>
                      <Button size="sm" variant="ghost">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {detalles.length > 0 && (
            <>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Precio Unit.</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detalles.map((detalle) => (
                      <TableRow key={detalle.productoId}>
                        <TableCell>{detalle.nombre}</TableCell>
                        <TableCell>{detalle.codigo}</TableCell>
                        <TableCell>${detalle.precioUnitario.toFixed(2)}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            value={detalle.cantidad}
                            onChange={(e) =>
                              actualizarCantidad(
                                detalle.productoId,
                                parseInt(e.target.value) || 1
                              )
                            }
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${detalle.subtotal.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => eliminarProducto(detalle.productoId)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-2">
                <Label>Notas (opcional)</Label>
                <Textarea
                  placeholder="Agregar notas o instrucciones especiales..."
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                />
              </div>

              <div className="space-y-2 pt-4 border-t">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>IVA (16%):</span>
                  <span>${impuestos.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>${total.toFixed(2)}</span>
                </div>
                {total > creditoDisponible && (
                  <p className="text-sm text-destructive">
                    ⚠️ El total excede tu crédito disponible
                  </p>
                )}
              </div>

              <Button
                className="w-full"
                onClick={crearPedido}
                disabled={loading || total > creditoDisponible}
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                {loading ? "Procesando..." : "Crear Pedido"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClienteNuevoPedido;
