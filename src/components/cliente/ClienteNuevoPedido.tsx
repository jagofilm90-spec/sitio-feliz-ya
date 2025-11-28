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
import { Plus, Trash2, ShoppingCart, Search, MapPin } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, calcularDesgloseImpuestos } from "@/lib/utils";

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
  aplica_iva: boolean;
  aplica_ieps: boolean;
}

interface Sucursal {
  id: string;
  nombre: string;
  direccion: string;
  contacto: string | null;
  telefono: string | null;
}

const ClienteNuevoPedido = ({ clienteId, limiteCredito, saldoPendiente }: ClienteNuevoPedidoProps) => {
  const [productos, setProductos] = useState<any[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [selectedSucursalId, setSelectedSucursalId] = useState<string>("");
  const [detalles, setDetalles] = useState<DetalleProducto[]>([]);
  const [notas, setNotas] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    loadProductos();
    loadSucursales();
  }, [clienteId]);

  const loadProductos = async () => {
    try {
      const { data, error } = await supabase
        .from("productos")
        .select("id, nombre, codigo, unidad, precio_venta, stock_actual, aplica_iva, aplica_ieps")
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

  const loadSucursales = async () => {
    try {
      const { data, error } = await supabase
        .from("cliente_sucursales")
        .select("id, nombre, direccion, contacto, telefono")
        .eq("cliente_id", clienteId)
        .eq("activo", true)
        .order("nombre");

      if (error) throw error;
      
      const sucursalesData = data || [];
      setSucursales(sucursalesData);
      
      // Si solo hay una sucursal, seleccionarla automáticamente
      if (sucursalesData.length === 1) {
        setSelectedSucursalId(sucursalesData[0].id);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudieron cargar las sucursales",
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
      aplica_iva: producto.aplica_iva || false,
      aplica_ieps: producto.aplica_ieps || false,
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
    let subtotalNeto = 0;
    let totalIva = 0;
    let totalIeps = 0;

    detalles.forEach((d) => {
      const desglose = calcularDesgloseImpuestos(d.subtotal, d.aplica_iva, d.aplica_ieps);
      subtotalNeto += desglose.base;
      totalIva += desglose.iva;
      totalIeps += desglose.ieps;
    });

    // Redondear a 2 decimales
    subtotalNeto = Math.round(subtotalNeto * 100) / 100;
    totalIva = Math.round(totalIva * 100) / 100;
    totalIeps = Math.round(totalIeps * 100) / 100;
    const total = Math.round((subtotalNeto + totalIva + totalIeps) * 100) / 100;

    return { 
      subtotal: subtotalNeto, 
      iva: totalIva,
      ieps: totalIeps,
      impuestos: totalIva + totalIeps, 
      total 
    };
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

    if (sucursales.length > 0 && !selectedSucursalId) {
      toast({
        title: "Selecciona una sucursal",
        description: "Debes seleccionar una sucursal de entrega",
        variant: "destructive",
      });
      return;
    }

    if (!validarCredito()) return;

    setLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Usuario no autenticado");

      const totalesGuardar = calcularTotales();
      
      // Generar folio único
      const timestamp = Date.now().toString().slice(-6);
      const folio = `PED-CLI-${timestamp}`;

      // Crear pedido
      const { data: pedido, error: pedidoError } = await supabase
        .from("pedidos")
        .insert({
          folio,
          cliente_id: clienteId,
          vendedor_id: user.user.id,
          sucursal_id: selectedSucursalId || null,
          fecha_pedido: new Date().toISOString(),
          subtotal: totalesGuardar.subtotal,
          impuestos: totalesGuardar.impuestos,
          total: totalesGuardar.total,
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

  const totales = calcularTotales();
  const { subtotal, iva, ieps, total } = totales;
  const creditoDisponible = limiteCredito - saldoPendiente;
  const selectedSucursal = sucursales.find(s => s.id === selectedSucursalId);

  return (
    <div className="space-y-6">
      {/* Selector de Sucursal */}
      {sucursales.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Dirección de Entrega
            </CardTitle>
            <CardDescription>
              {sucursales.length === 1 
                ? "Tu dirección de entrega configurada"
                : "Selecciona la sucursal donde recibirás el pedido"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sucursales.length === 1 ? (
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium">{sucursales[0].nombre}</p>
                <p className="text-sm text-muted-foreground">{sucursales[0].direccion}</p>
                {sucursales[0].contacto && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Contacto: {sucursales[0].contacto} {sucursales[0].telefono && `- ${sucursales[0].telefono}`}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <Select value={selectedSucursalId} onValueChange={setSelectedSucursalId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una sucursal" />
                  </SelectTrigger>
                  <SelectContent>
                    {sucursales.map((sucursal) => (
                      <SelectItem key={sucursal.id} value={sucursal.id}>
                        {sucursal.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {selectedSucursal && (
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="font-medium">{selectedSucursal.nombre}</p>
                    <p className="text-sm text-muted-foreground">{selectedSucursal.direccion}</p>
                    {selectedSucursal.contacto && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Contacto: {selectedSucursal.contacto} {selectedSucursal.telefono && `- ${selectedSucursal.telefono}`}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {sucursales.length === 0 && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">Sin dirección de entrega</p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Contacta a tu vendedor para configurar tu dirección de entrega
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                        <TableCell>${formatCurrency(detalle.precioUnitario)}</TableCell>
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
                        <TableCell className="text-right font-medium font-mono">
                          ${formatCurrency(detalle.subtotal)}
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
                  <span className="font-mono">${formatCurrency(subtotal)}</span>
                </div>
                {iva > 0 && (
                  <div className="flex justify-between text-sm text-blue-600">
                    <span>IVA (16%):</span>
                    <span className="font-mono">${formatCurrency(iva)}</span>
                  </div>
                )}
                {ieps > 0 && (
                  <div className="flex justify-between text-sm text-orange-600">
                    <span>IEPS (8%):</span>
                    <span className="font-mono">${formatCurrency(ieps)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span className="font-mono">${formatCurrency(total)}</span>
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
                disabled={loading || total > creditoDisponible || (sucursales.length > 0 && !selectedSucursalId)}
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
