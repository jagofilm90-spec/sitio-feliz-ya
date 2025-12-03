import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Save, Check, Filter, X, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
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
import { calcularSubtotal, calcularDesgloseImpuestos, redondear } from "@/lib/calculos";
import { cn } from "@/lib/utils";

// Solo Piloncillo requiere verificación manual (peso variable por caja)
// Anís y Canela Molida se convierten automáticamente usando kg_por_unidad
const PRODUCTOS_VERIFICACION = ['piloncillo'];

const esProductoVerificable = (nombre: string) => {
  const nombreLower = nombre?.toLowerCase() || '';
  return nombreLower.includes('piloncillo');
};

const getTipoProducto = (nombre: string): string => {
  const nombreLower = nombre?.toLowerCase() || '';
  if (nombreLower.includes('piloncillo')) return 'Piloncillo';
  return 'Otro';
};

const getTipoUnidad = (nombre: string): string => {
  // Piloncillo siempre usa cajas
  return 'cajas';
};

interface ProductoVerificacion {
  detalleId: string;
  pedidoId: string;
  sucursalNombre: string;
  sucursalCodigo: string;
  productoNombre: string;
  tipoProducto: string;
  tipoUnidad: string;
  cantidadOriginal: number;
  cantidadKg: number;
  cantidadUnidades: number;
  precioUnitario: number;
  verificado: boolean;
}

interface VerificacionRapidaLecarozProps {
  onClose: () => void;
}

export function VerificacionRapidaLecaroz({ onClose }: VerificacionRapidaLecarozProps) {
  const [filtroProducto, setFiltroProducto] = useState<string>("todos");
  const [productos, setProductos] = useState<ProductoVerificacion[]>([]);
  const [guardando, setGuardando] = useState(false);
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const queryClient = useQueryClient();

  // Fetch all cumulative orders with their details
  const { data: pedidosConDetalles, isLoading } = useQuery({
    queryKey: ["verificacion-rapida-lecaroz"],
    queryFn: async () => {
      const { data: pedidos, error: pedidosError } = await supabase
        .from("pedidos_acumulativos")
        .select(`
          id,
          cliente_sucursales:sucursal_id(nombre, codigo_sucursal)
        `)
        .eq("status", "borrador");

      if (pedidosError) throw pedidosError;
      if (!pedidos || pedidos.length === 0) return [];

      const pedidoIds = pedidos.map(p => p.id);
      
      const { data: detalles, error: detallesError } = await supabase
        .from("pedidos_acumulativos_detalles")
        .select(`
          id,
          pedido_acumulativo_id,
          producto_id,
          cantidad,
          precio_unitario,
          subtotal,
          verificado,
          unidades_manual,
          productos:producto_id(nombre, codigo)
        `)
        .in("pedido_acumulativo_id", pedidoIds);

      if (detallesError) throw detallesError;

      // Filter only verifiable products and map to our structure
      const productosVerificables: ProductoVerificacion[] = [];
      
      detalles?.forEach((det: any) => {
        if (esProductoVerificable(det.productos?.nombre)) {
          const pedido = pedidos.find(p => p.id === det.pedido_acumulativo_id);
          const tipoProducto = getTipoProducto(det.productos?.nombre);
          
          productosVerificables.push({
            detalleId: det.id,
            pedidoId: det.pedido_acumulativo_id,
            sucursalNombre: pedido?.cliente_sucursales?.nombre || 'Sin sucursal',
            sucursalCodigo: pedido?.cliente_sucursales?.codigo_sucursal || '',
            productoNombre: det.productos?.nombre || 'Producto',
            tipoProducto,
            tipoUnidad: getTipoUnidad(det.productos?.nombre),
            cantidadOriginal: det.cantidad,
            cantidadKg: det.cantidad,
            cantidadUnidades: det.unidades_manual || 1,
            precioUnitario: det.precio_unitario,
            verificado: det.verificado || false,
          });
        }
      });

      // Sort by branch code numerically
      productosVerificables.sort((a, b) => {
        const numA = parseInt(a.sucursalCodigo);
        const numB = parseInt(b.sucursalCodigo);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.sucursalCodigo.localeCompare(b.sucursalCodigo);
      });

      return productosVerificables;
    },
  });

  // Initialize local state when data loads
  useEffect(() => {
    if (pedidosConDetalles) {
      setProductos(pedidosConDetalles);
    }
  }, [pedidosConDetalles]);

  // Filtered products
  const productosFiltrados = useMemo(() => {
    if (filtroProducto === "todos") return productos;
    return productos.filter(p => p.tipoProducto === filtroProducto);
  }, [productos, filtroProducto]);

  // Stats
  const stats = useMemo(() => {
    const total = productos.length;
    const verificados = productos.filter(p => p.verificado).length;
    const porTipo = {
      Piloncillo: productos.filter(p => p.tipoProducto === 'Piloncillo').length,
      Canela: productos.filter(p => p.tipoProducto === 'Canela').length,
      Anís: productos.filter(p => p.tipoProducto === 'Anís').length,
      Bicarbonato: productos.filter(p => p.tipoProducto === 'Bicarbonato').length,
    };
    return { total, verificados, pendientes: total - verificados, porTipo };
  }, [productos]);

  // Update a product field
  const updateProducto = useCallback((detalleId: string, field: keyof ProductoVerificacion, value: any) => {
    setProductos(prev => prev.map(p => 
      p.detalleId === detalleId ? { ...p, [field]: value } : p
    ));
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent, detalleId: string, field: 'kg' | 'unidades') => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Mark as verified and move to next row
      updateProducto(detalleId, 'verificado', true);
      
      const currentIndex = productosFiltrados.findIndex(p => p.detalleId === detalleId);
      const nextProduct = productosFiltrados[currentIndex + 1];
      if (nextProduct) {
        const nextInput = inputRefs.current.get(`${nextProduct.detalleId}-kg`);
        nextInput?.focus();
        nextInput?.select();
      }
    } else if (e.key === 'Tab' && !e.shiftKey && field === 'unidades') {
      // After unidades, move to next row's kg
      const currentIndex = productosFiltrados.findIndex(p => p.detalleId === detalleId);
      const nextProduct = productosFiltrados[currentIndex + 1];
      if (nextProduct) {
        e.preventDefault();
        const nextInput = inputRefs.current.get(`${nextProduct.detalleId}-kg`);
        nextInput?.focus();
        nextInput?.select();
      }
    }
  }, [productosFiltrados, updateProducto]);

  // Save all changes
  const guardarTodo = async () => {
    setGuardando(true);
    
    try {
      const productosModificados = productos.filter(p => 
        p.cantidadKg !== p.cantidadOriginal || p.verificado
      );

      if (productosModificados.length === 0) {
        toast.info("No hay cambios para guardar");
        setGuardando(false);
        return;
      }

      // *** ALERTA PARA CANELA MOLIDA / ANÍS >12 KG ***
      const productosConCantidadInusual = productosModificados.filter(p => {
        const nombreLower = p.productoNombre?.toLowerCase() || '';
        const esCanelaoAnis = nombreLower.includes('canela molida') || 
                             nombreLower.includes('anís') || 
                             nombreLower.includes('anis');
        return esCanelaoAnis && p.cantidadKg > 12;
      });

      if (productosConCantidadInusual.length > 0) {
        const listaProductos = productosConCantidadInusual.map(p => 
          `• ${p.sucursalCodigo} ${p.sucursalNombre}: ${p.productoNombre} - ${p.cantidadKg} kg`
        ).join('\n');
        
        const confirmar = window.confirm(
          `⚠️ CANTIDADES INUSUALES DETECTADAS\n\n` +
          `${listaProductos}\n\n` +
          `Es muy raro que una panadería pida más de 12 kg de Canela Molida o Anís.\n` +
          `¿Estás seguro de que las cantidades son correctas?`
        );
        
        if (!confirmar) {
          setGuardando(false);
          return;
        }
      }

      // Group by pedido to update totals efficiently
      const pedidosAfectados = new Set<string>();
      
      for (const producto of productosModificados) {
        const nuevoSubtotal = producto.cantidadKg * producto.precioUnitario;
        
        const { error } = await supabase
          .from("pedidos_acumulativos_detalles")
          .update({ 
            cantidad: producto.cantidadKg, 
            subtotal: nuevoSubtotal,
            verificado: producto.verificado,
            unidades_manual: producto.cantidadUnidades
          })
          .eq("id", producto.detalleId);

        if (error) throw error;
        
        if (producto.cantidadKg !== producto.cantidadOriginal) {
          pedidosAfectados.add(producto.pedidoId);
        }
      }

      // Recalculate totals for affected orders
      for (const pedidoId of pedidosAfectados) {
        const { data: detalles } = await supabase
          .from("pedidos_acumulativos_detalles")
          .select(`*, productos:producto_id(aplica_iva, aplica_ieps, nombre)`)
          .eq("pedido_acumulativo_id", pedidoId);

        let subtotalTotal = 0, ivaTotal = 0, iepsTotal = 0;

        for (const det of detalles || []) {
          const desglose = calcularDesgloseImpuestos({
            precio_con_impuestos: det.subtotal,
            aplica_iva: det.productos?.aplica_iva || false,
            aplica_ieps: det.productos?.aplica_ieps || false,
            nombre_producto: det.productos?.nombre || ''
          });
          subtotalTotal += desglose.base;
          ivaTotal += desglose.iva;
          iepsTotal += desglose.ieps;
        }

        await supabase.from("pedidos_acumulativos").update({
          subtotal: redondear(subtotalTotal),
          impuestos: redondear(ivaTotal + iepsTotal),
          total: redondear(subtotalTotal + ivaTotal + iepsTotal)
        }).eq("id", pedidoId);
      }

      const verificadosCount = productosModificados.filter(p => p.verificado).length;
      const modificadosCount = productosModificados.filter(p => p.cantidadKg !== p.cantidadOriginal).length;
      
      toast.success(`${verificadosCount} verificados, ${modificadosCount} cantidades modificadas`);
      await queryClient.invalidateQueries({ queryKey: ["pedidos-acumulativos"] });
      await queryClient.invalidateQueries({ queryKey: ["verificacion-rapida-lecaroz"] });
      await queryClient.invalidateQueries({ queryKey: ["pedidos-acumulativos-all-detalles-verificacion"] });
      
    } catch (error: any) {
      toast.error("Error al guardar: " + error.message);
    } finally {
      setGuardando(false);
    }
  };

  // Mark all filtered as verified
  const marcarTodosVerificados = () => {
    const idsToUpdate = productosFiltrados.map(p => p.detalleId);
    setProductos(prev => prev.map(p => 
      idsToUpdate.includes(p.detalleId) ? { ...p, verificado: true } : p
    ));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-xl font-semibold">Verificación Rápida de Pesos</h2>
            <p className="text-sm text-muted-foreground">
              Edita kg y unidades directamente • Tab/Enter para navegar
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={marcarTodosVerificados}
          >
            <Check className="h-4 w-4 mr-1" />
            Verificar todos
          </Button>
          <Button 
            onClick={guardarTodo}
            disabled={guardando}
          >
            {guardando ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Guardar Todo
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-lg px-3 py-1">
                  {stats.verificados}/{stats.total}
                </Badge>
                <span className="text-sm text-muted-foreground">verificados</span>
              </div>
              
              <div className="flex gap-2">
                {stats.porTipo.Piloncillo > 0 && (
                  <Badge variant="secondary">Piloncillo: {stats.porTipo.Piloncillo}</Badge>
                )}
                {stats.porTipo.Canela > 0 && (
                  <Badge variant="secondary">Canela: {stats.porTipo.Canela}</Badge>
                )}
                {stats.porTipo.Anís > 0 && (
                  <Badge variant="secondary">Anís: {stats.porTipo.Anís}</Badge>
                )}
                {stats.porTipo.Bicarbonato > 0 && (
                  <Badge variant="secondary">Bicarbonato: {stats.porTipo.Bicarbonato}</Badge>
                )}
              </div>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filtroProducto} onValueChange={setFiltroProducto}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="Piloncillo">Piloncillo</SelectItem>
                  <SelectItem value="Canela">Canela</SelectItem>
                  <SelectItem value="Anís">Anís</SelectItem>
                  <SelectItem value="Bicarbonato">Bicarbonato</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <ScrollArea className="h-[calc(100vh-280px)]">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-12">✓</TableHead>
                <TableHead className="w-20">Código</TableHead>
                <TableHead>Sucursal</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead className="w-28 text-right">Kg</TableHead>
                <TableHead className="w-28 text-right">Unidades</TableHead>
                <TableHead className="w-20 text-center">Tipo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productosFiltrados.map((producto, index) => (
                <TableRow 
                  key={producto.detalleId}
                  className={cn(
                    producto.verificado && "bg-green-50 dark:bg-green-950/20"
                  )}
                >
                  <TableCell>
                    <Checkbox
                      checked={producto.verificado}
                      onCheckedChange={(checked) => 
                        updateProducto(producto.detalleId, 'verificado', !!checked)
                      }
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {producto.sucursalCodigo}
                  </TableCell>
                  <TableCell className="font-medium">
                    {producto.sucursalNombre}
                  </TableCell>
                  <TableCell>{producto.productoNombre}</TableCell>
                  <TableCell className="text-right">
                    <Input
                      ref={(el) => {
                        if (el) inputRefs.current.set(`${producto.detalleId}-kg`, el);
                      }}
                      type="number"
                      step="0.01"
                      value={producto.cantidadKg}
                      onChange={(e) => updateProducto(producto.detalleId, 'cantidadKg', parseFloat(e.target.value) || 0)}
                      onKeyDown={(e) => handleKeyDown(e, producto.detalleId, 'kg')}
                      className="w-24 text-right h-8"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      ref={(el) => {
                        if (el) inputRefs.current.set(`${producto.detalleId}-unidades`, el);
                      }}
                      type="number"
                      value={producto.cantidadUnidades}
                      onChange={(e) => updateProducto(producto.detalleId, 'cantidadUnidades', parseInt(e.target.value) || 1)}
                      onKeyDown={(e) => handleKeyDown(e, producto.detalleId, 'unidades')}
                      className="w-20 text-right h-8"
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="text-xs">
                      {producto.tipoUnidad}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              
              {productosFiltrados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No hay productos que requieran verificación
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      {/* Keyboard shortcuts hint */}
      <div className="flex justify-center gap-4 text-xs text-muted-foreground">
        <span><kbd className="px-1.5 py-0.5 bg-muted rounded">Tab</kbd> siguiente campo</span>
        <span><kbd className="px-1.5 py-0.5 bg-muted rounded">Enter</kbd> verificar y siguiente fila</span>
      </div>
    </div>
  );
}
