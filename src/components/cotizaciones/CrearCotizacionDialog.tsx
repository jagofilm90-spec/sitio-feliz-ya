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
import { Textarea } from "@/components/ui/textarea";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Trash2, Search, FileText } from "lucide-react";
import { format, addDays } from "date-fns";

interface DetalleProducto {
  producto_id: string;
  nombre: string;
  codigo: string;
  unidad: string;
  precio_unitario: number;
  cantidad: number;
  subtotal: number;
}

interface Cliente {
  id: string;
  nombre: string;
  codigo: string;
}

interface Sucursal {
  id: string;
  nombre: string;
  direccion: string;
}

interface Producto {
  id: string;
  nombre: string;
  codigo: string;
  unidad: string;
  precio_venta: number;
  stock_actual: number;
  aplica_iva: boolean;
  aplica_ieps: boolean;
}

interface CrearCotizacionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emailOrigen?: { id: string; subject: string; from: string };
  gmailCuentaId?: string;
  onSuccess?: (cotizacionId: string) => void;
}

const CrearCotizacionDialog = ({
  open,
  onOpenChange,
  emailOrigen,
  gmailCuentaId,
  onSuccess,
}: CrearCotizacionDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showProductSearch, setShowProductSearch] = useState(false);

  const [selectedCliente, setSelectedCliente] = useState<string>("");
  const [selectedSucursal, setSelectedSucursal] = useState<string>("");
  const [vigenciaDias, setVigenciaDias] = useState(7);
  const [notas, setNotas] = useState("");
  const [detalles, setDetalles] = useState<DetalleProducto[]>([]);

  useEffect(() => {
    if (open) {
      loadClientes();
      loadProductos();
    }
  }, [open]);

  useEffect(() => {
    if (selectedCliente) {
      loadSucursales(selectedCliente);
    } else {
      setSucursales([]);
      setSelectedSucursal("");
    }
  }, [selectedCliente]);

  const loadClientes = async () => {
    const { data, error } = await supabase
      .from("clientes")
      .select("id, nombre, codigo")
      .eq("activo", true)
      .order("nombre");

    if (!error && data) {
      setClientes(data);
    }
  };

  const loadSucursales = async (clienteId: string) => {
    const { data, error } = await supabase
      .from("cliente_sucursales")
      .select("id, nombre, direccion")
      .eq("cliente_id", clienteId)
      .eq("activo", true);

    if (!error && data) {
      setSucursales(data);
      if (data.length === 1) {
        setSelectedSucursal(data[0].id);
      }
    }
  };

  const loadProductos = async () => {
    const { data, error } = await supabase
      .from("productos")
      .select("id, nombre, codigo, unidad, precio_venta, stock_actual, aplica_iva, aplica_ieps")
      .eq("activo", true)
      .order("nombre");

    if (!error && data) {
      setProductos(data);
    }
  };

  const productosFiltrados = productos.filter(
    (p) =>
      p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.codigo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const agregarProducto = (producto: Producto) => {
    const existe = detalles.find((d) => d.producto_id === producto.id);
    if (existe) {
      toast({
        title: "Producto ya agregado",
        description: "El producto ya está en la cotización",
        variant: "destructive",
      });
      return;
    }

    setDetalles([
      ...detalles,
      {
        producto_id: producto.id,
        nombre: producto.nombre,
        codigo: producto.codigo,
        unidad: producto.unidad,
        precio_unitario: producto.precio_venta,
        cantidad: 1,
        subtotal: producto.precio_venta,
      },
    ]);
    setSearchTerm("");
    setShowProductSearch(false);
  };

  const actualizarCantidad = (index: number, cantidad: number) => {
    const nuevosDetalles = [...detalles];
    nuevosDetalles[index].cantidad = cantidad;
    nuevosDetalles[index].subtotal = cantidad * nuevosDetalles[index].precio_unitario;
    setDetalles(nuevosDetalles);
  };

  const actualizarPrecio = (index: number, precio: number) => {
    const nuevosDetalles = [...detalles];
    nuevosDetalles[index].precio_unitario = precio;
    nuevosDetalles[index].subtotal = nuevosDetalles[index].cantidad * precio;
    setDetalles(nuevosDetalles);
  };

  const eliminarProducto = (index: number) => {
    setDetalles(detalles.filter((_, i) => i !== index));
  };

  const calcularTotales = () => {
    const subtotal = detalles.reduce((acc, d) => acc + d.subtotal, 0);
    const impuestos = subtotal * 0.16; // IVA 16%
    const total = subtotal + impuestos;
    return { subtotal, impuestos, total };
  };

  const handleCrear = async () => {
    if (!selectedCliente) {
      toast({
        title: "Selecciona un cliente",
        variant: "destructive",
      });
      return;
    }

    if (detalles.length === 0) {
      toast({
        title: "Agrega productos",
        description: "La cotización debe tener al menos un producto",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user) {
        throw new Error("No hay sesión activa");
      }

      // Generate folio
      const { data: folioData, error: folioError } = await supabase.rpc(
        "generar_folio_cotizacion"
      );

      if (folioError) throw folioError;

      const totales = calcularTotales();
      const fechaVigencia = addDays(new Date(), vigenciaDias);

      // Create cotizacion
      const { data: cotizacion, error: cotizacionError } = await supabase
        .from("cotizaciones")
        .insert({
          folio: folioData,
          cliente_id: selectedCliente,
          sucursal_id: selectedSucursal || null,
          fecha_vigencia: format(fechaVigencia, "yyyy-MM-dd"),
          email_origen_id: emailOrigen?.id || null,
          gmail_cuenta_id: gmailCuentaId || null,
          notas,
          subtotal: totales.subtotal,
          impuestos: totales.impuestos,
          total: totales.total,
          creado_por: session.session.user.id,
        })
        .select()
        .single();

      if (cotizacionError) throw cotizacionError;

      // Create detalles
      const detallesInsert = detalles.map((d) => ({
        cotizacion_id: cotizacion.id,
        producto_id: d.producto_id,
        cantidad: d.cantidad,
        precio_unitario: d.precio_unitario,
        subtotal: d.subtotal,
      }));

      const { error: detallesError } = await supabase
        .from("cotizaciones_detalles")
        .insert(detallesInsert);

      if (detallesError) throw detallesError;

      toast({
        title: "Cotización creada",
        description: `Folio: ${folioData}`,
      });

      onSuccess?.(cotizacion.id);
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error("Error creating cotizacion:", error);
      toast({
        title: "Error al crear cotización",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedCliente("");
    setSelectedSucursal("");
    setVigenciaDias(7);
    setNotas("");
    setDetalles([]);
    setSearchTerm("");
  };

  const totales = calcularTotales();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Nueva Cotización
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {emailOrigen && (
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p className="font-medium">Creando desde email:</p>
              <p className="text-muted-foreground">{emailOrigen.subject}</p>
              <p className="text-muted-foreground text-xs">De: {emailOrigen.from}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select value={selectedCliente} onValueChange={setSelectedCliente}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre} ({c.codigo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Sucursal de entrega</Label>
              <Select
                value={selectedSucursal}
                onValueChange={setSelectedSucursal}
                disabled={!selectedCliente || sucursales.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={sucursales.length === 0 ? "Sin sucursales" : "Seleccionar"} />
                </SelectTrigger>
                <SelectContent>
                  {sucursales.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Vigencia (días)</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={vigenciaDias}
                onChange={(e) => setVigenciaDias(parseInt(e.target.value) || 7)}
              />
            </div>

            <div className="space-y-2">
              <Label>Fecha de vencimiento</Label>
              <Input
                value={format(addDays(new Date(), vigenciaDias), "dd/MM/yyyy")}
                disabled
              />
            </div>
          </div>

          {/* Product search */}
          <div className="space-y-2">
            <Label>Agregar productos</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar producto por nombre o código..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowProductSearch(e.target.value.length > 0);
                }}
                onFocus={() => searchTerm.length > 0 && setShowProductSearch(true)}
                className="pl-10"
              />
            </div>

            {showProductSearch && productosFiltrados.length > 0 && (
              <div className="absolute z-50 w-full max-w-[calc(100%-3rem)] bg-background border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {productosFiltrados.slice(0, 10).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => agregarProducto(p)}
                    className="w-full px-4 py-2 text-left hover:bg-muted flex items-center justify-between"
                  >
                    <div>
                      <span className="font-medium">{p.nombre}</span>
                      <span className="text-muted-foreground text-sm ml-2">
                        ({p.codigo})
                      </span>
                    </div>
                    <span className="text-sm">
                      ${p.precio_venta.toFixed(2)} / {p.unidad}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Products table */}
          {detalles.length > 0 && (
            <div className="border rounded-lg">
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
                  {detalles.map((d, index) => (
                    <TableRow key={d.producto_id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{d.nombre}</p>
                          <p className="text-xs text-muted-foreground">
                            {d.codigo} • {d.unidad}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          value={d.cantidad}
                          onChange={(e) =>
                            actualizarCantidad(index, parseInt(e.target.value) || 1)
                          }
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={d.precio_unitario}
                          onChange={(e) =>
                            actualizarPrecio(index, parseFloat(e.target.value) || 0)
                          }
                          className="w-28"
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${d.subtotal.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => eliminarProducto(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              placeholder="Notas adicionales para la cotización..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
            />
          </div>

          {/* Totals */}
          {detalles.length > 0 && (
            <div className="flex justify-end">
              <div className="w-64 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>${totales.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>IVA (16%):</span>
                  <span>${totales.impuestos.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total:</span>
                  <span>${totales.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCrear} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Crear Cotización
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CrearCotizacionDialog;
