import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Search, ShoppingCart, Building2 } from "lucide-react";
import { formatCurrency, calcularDesgloseImpuestos } from "@/lib/utils";

interface NuevoPedidoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPedidoCreated: () => void;
}

interface Cliente {
  id: string;
  codigo: string;
  nombre: string;
  preferencia_facturacion: string;
}

interface Sucursal {
  id: string;
  nombre: string;
  direccion: string;
  rfc: string | null;
  razon_social: string | null;
}

interface Producto {
  id: string;
  codigo: string;
  nombre: string;
  precio_venta: number;
  unidad: string;
  aplica_iva: boolean;
  aplica_ieps: boolean;
  stock_actual: number;
  kg_por_unidad: number | null;
}

interface DetallePedido {
  producto_id: string;
  producto: Producto;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

const NuevoPedidoDialog = ({ open, onOpenChange, onPedidoCreated }: NuevoPedidoDialogProps) => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [selectedClienteId, setSelectedClienteId] = useState<string>("");
  const [selectedSucursalId, setSelectedSucursalId] = useState<string>("");
  const [requiereFactura, setRequiereFactura] = useState(false);
  const [notas, setNotas] = useState("");
  const [detalles, setDetalles] = useState<DetallePedido[]>([]);
  const [searchProducto, setSearchProducto] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadClientes();
      loadProductos();
    }
  }, [open]);

  useEffect(() => {
    if (selectedClienteId) {
      loadSucursales(selectedClienteId);
      // Set default factura preference based on client
      const cliente = clientes.find(c => c.id === selectedClienteId);
      if (cliente) {
        setRequiereFactura(cliente.preferencia_facturacion === "siempre_factura");
      }
    } else {
      setSucursales([]);
      setSelectedSucursalId("");
    }
  }, [selectedClienteId]);

  const loadClientes = async () => {
    const { data, error } = await supabase
      .from("clientes")
      .select("id, codigo, nombre, preferencia_facturacion")
      .eq("activo", true)
      .order("nombre");

    if (!error && data) {
      setClientes(data);
    }
  };

  const loadSucursales = async (clienteId: string) => {
    const { data, error } = await supabase
      .from("cliente_sucursales")
      .select("id, nombre, direccion, rfc, razon_social")
      .eq("cliente_id", clienteId)
      .eq("activo", true)
      .order("nombre");

    if (!error && data) {
      setSucursales(data);
      if (data.length === 1) {
        setSelectedSucursalId(data[0].id);
      }
    }
  };

  const loadProductos = async () => {
    const { data, error } = await supabase
      .from("productos")
      .select("id, codigo, nombre, precio_venta, unidad, aplica_iva, aplica_ieps, stock_actual, kg_por_unidad")
      .eq("activo", true)
      .order("nombre");

    if (!error && data) {
      setProductos(data);
    }
  };

  const filteredProductos = productos.filter(p =>
    !detalles.some(d => d.producto_id === p.id) &&
    (p.nombre.toLowerCase().includes(searchProducto.toLowerCase()) ||
     p.codigo.toLowerCase().includes(searchProducto.toLowerCase()))
  );

  const addProducto = (producto: Producto) => {
    setDetalles([...detalles, {
      producto_id: producto.id,
      producto,
      cantidad: 1,
      precio_unitario: producto.precio_venta,
      subtotal: producto.precio_venta,
    }]);
    setSearchProducto("");
  };

  const updateDetalle = (index: number, field: "cantidad" | "precio_unitario", value: number) => {
    const newDetalles = [...detalles];
    newDetalles[index][field] = value;
    newDetalles[index].subtotal = newDetalles[index].cantidad * newDetalles[index].precio_unitario;
    setDetalles(newDetalles);
  };

  const removeDetalle = (index: number) => {
    setDetalles(detalles.filter((_, i) => i !== index));
  };

  const calcularTotales = () => {
    let subtotalGeneral = 0;
    let ivaTotal = 0;
    let iepsTotal = 0;

    detalles.forEach(d => {
      const { base, iva, ieps } = calcularDesgloseImpuestos(
        d.subtotal,
        d.producto.aplica_iva,
        d.producto.aplica_ieps
      );
      subtotalGeneral += base;
      ivaTotal += iva;
      iepsTotal += ieps;
    });

    return {
      subtotal: subtotalGeneral,
      iva: ivaTotal,
      ieps: iepsTotal,
      total: subtotalGeneral + ivaTotal + iepsTotal,
    };
  };

  const calcularPesoTotal = () => {
    let pesoTotal = 0;
    detalles.forEach(d => {
      if (d.producto.kg_por_unidad) {
        pesoTotal += d.cantidad * d.producto.kg_por_unidad;
      }
    });
    return pesoTotal;
  };

  const handleCrearPedido = async () => {
    if (!selectedClienteId) {
      toast({ title: "Selecciona un cliente", variant: "destructive" });
      return;
    }
    if (sucursales.length > 0 && !selectedSucursalId) {
      toast({ title: "Selecciona una sucursal", variant: "destructive" });
      return;
    }
    if (detalles.length === 0) {
      toast({ title: "Agrega al menos un producto", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No autenticado");

      const totales = calcularTotales();
      const pesoTotal = calcularPesoTotal();
      const timestamp = Date.now();
      const folio = `PED-${timestamp}`;

      // Create pedido
      const { data: pedido, error: pedidoError } = await supabase
        .from("pedidos")
        .insert({
          folio,
          cliente_id: selectedClienteId,
          sucursal_id: selectedSucursalId || null,
          vendedor_id: userData.user.id,
          subtotal: totales.subtotal,
          impuestos: totales.iva + totales.ieps,
          total: totales.total,
          peso_total_kg: pesoTotal > 0 ? pesoTotal : null,
          requiere_factura: requiereFactura,
          notas: notas || null,
          status: "pendiente",
        })
        .select()
        .single();

      if (pedidoError) throw pedidoError;

      // Create detalles
      const detallesInsert = detalles.map(d => ({
        pedido_id: pedido.id,
        producto_id: d.producto_id,
        cantidad: d.cantidad,
        precio_unitario: d.precio_unitario,
        subtotal: d.subtotal,
      }));

      const { error: detallesError } = await supabase
        .from("pedidos_detalles")
        .insert(detallesInsert);

      if (detallesError) throw detallesError;

      toast({ title: "Pedido creado", description: `Folio: ${folio}` });
      resetForm();
      onPedidoCreated();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedClienteId("");
    setSelectedSucursalId("");
    setSucursales([]);
    setDetalles([]);
    setNotas("");
    setRequiereFactura(false);
    setSearchProducto("");
  };

  const totales = calcularTotales();
  const selectedSucursal = sucursales.find(s => s.id === selectedSucursalId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Nuevo Pedido
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Cliente y Sucursal */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select value={selectedClienteId} onValueChange={setSelectedClienteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cliente..." />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="font-mono text-xs mr-2">{c.codigo}</span>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Sucursal de entrega {sucursales.length > 0 && "*"}</Label>
              <Select 
                value={selectedSucursalId} 
                onValueChange={setSelectedSucursalId}
                disabled={!selectedClienteId || sucursales.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    !selectedClienteId 
                      ? "Primero selecciona cliente" 
                      : sucursales.length === 0 
                        ? "Sin sucursales" 
                        : "Seleccionar sucursal..."
                  } />
                </SelectTrigger>
                <SelectContent>
                  {sucursales.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3 w-3" />
                        {s.nombre}
                        {s.rfc && (
                          <Badge variant="outline" className="text-xs ml-1">
                            RFC propio
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedSucursal?.rfc && (
                <p className="text-xs text-muted-foreground">
                  Facturación: {selectedSucursal.razon_social} ({selectedSucursal.rfc})
                </p>
              )}
            </div>
          </div>

          {/* Opciones */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch 
                checked={requiereFactura} 
                onCheckedChange={setRequiereFactura}
                id="requiere-factura"
              />
              <Label htmlFor="requiere-factura">Requiere factura</Label>
            </div>
          </div>

          {/* Productos */}
          <div className="space-y-3">
            <Label>Productos</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar producto por nombre o código..."
                value={searchProducto}
                onChange={(e) => setSearchProducto(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {searchProducto && filteredProductos.length > 0 && (
              <div className="border rounded-md max-h-40 overflow-y-auto">
                {filteredProductos.slice(0, 10).map(p => (
                  <button
                    key={p.id}
                    onClick={() => addProducto(p)}
                    className="w-full px-3 py-2 text-left hover:bg-muted flex justify-between items-center"
                  >
                    <span>
                      <span className="font-mono text-xs mr-2">{p.codigo}</span>
                      {p.nombre}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      ${formatCurrency(p.precio_venta)} / {p.unidad}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {detalles.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="w-24">Cantidad</TableHead>
                    <TableHead className="w-32">Precio Unit.</TableHead>
                    <TableHead className="w-32 text-right">Subtotal</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detalles.map((d, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <div>
                          <span className="font-mono text-xs mr-2">{d.producto.codigo}</span>
                          {d.producto.nombre}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {d.producto.aplica_iva && <Badge variant="outline" className="mr-1">IVA</Badge>}
                          {d.producto.aplica_ieps && <Badge variant="outline">IEPS</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          value={d.cantidad}
                          onChange={(e) => updateDetalle(idx, "cantidad", Number(e.target.value))}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={d.precio_unitario}
                          onChange={(e) => updateDetalle(idx, "precio_unitario", Number(e.target.value))}
                          className="w-28"
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${formatCurrency(d.subtotal)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeDetalle(idx)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label>Notas (opcional)</Label>
            <Textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Notas adicionales para el pedido..."
              rows={2}
            />
          </div>

          {/* Totales */}
          {detalles.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span className="font-mono">${formatCurrency(totales.subtotal)}</span>
              </div>
              {totales.iva > 0 && (
                <div className="flex justify-between text-sm">
                  <span>IVA (16%):</span>
                  <span className="font-mono">${formatCurrency(totales.iva)}</span>
                </div>
              )}
              {totales.ieps > 0 && (
                <div className="flex justify-between text-sm">
                  <span>IEPS (8%):</span>
                  <span className="font-mono">${formatCurrency(totales.ieps)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total:</span>
                <span className="font-mono">${formatCurrency(totales.total)}</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCrearPedido} disabled={loading}>
              {loading ? "Creando..." : "Crear Pedido"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NuevoPedidoDialog;
