import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Sparkles,
  Building2,
  Package,
  AlertCircle,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface ParsedProduct {
  nombre_producto: string;
  cantidad: number;
  unidad: string;
  precio_sugerido?: number | null;
  notas?: string;
  producto_id?: string;
  precio_unitario?: number;
}

interface ParsedSucursal {
  nombre_sucursal: string;
  fecha_entrega_solicitada?: string | null;
  productos: ParsedProduct[];
  sucursal_id?: string;
}

interface ParsedOrder {
  sucursales: ParsedSucursal[];
  notas_generales?: string;
  confianza: number;
}

interface ProcesarPedidoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emailBody: string;
  emailSubject: string;
  emailFrom: string;
  emailId: string;
  onSuccess?: () => void;
}

export default function ProcesarPedidoDialog({
  open,
  onOpenChange,
  emailBody,
  emailSubject,
  emailFrom,
  emailId,
  onSuccess,
}: ProcesarPedidoDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [parsing, setParsing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [parsedOrder, setParsedOrder] = useState<ParsedOrder | null>(null);
  const [selectedClienteId, setSelectedClienteId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Fetch clientes
  const { data: clientes } = useQuery({
    queryKey: ["clientes-activos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nombre, codigo")
        .eq("activo", true)
        .order("nombre");
      if (error) throw error;
      return data;
    },
  });

  // Fetch sucursales for selected cliente
  const { data: sucursales } = useQuery({
    queryKey: ["cliente-sucursales", selectedClienteId],
    queryFn: async () => {
      if (!selectedClienteId) return [];
      const { data, error } = await supabase
        .from("cliente_sucursales")
        .select("id, nombre, direccion")
        .eq("cliente_id", selectedClienteId)
        .eq("activo", true);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClienteId,
  });

  // Fetch productos
  const { data: productos } = useQuery({
    queryKey: ["productos-activos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("productos")
        .select("id, nombre, codigo, precio_venta, unidad")
        .eq("activo", true)
        .order("nombre");
      if (error) throw error;
      return data;
    },
  });

  // Auto-detect cliente from email
  useEffect(() => {
    if (open && clientes && emailFrom) {
      const emailLower = emailFrom.toLowerCase();
      // Try to match cliente by email or name in the from field
      const matchedCliente = clientes.find(c => 
        emailLower.includes(c.nombre.toLowerCase()) ||
        emailLower.includes(c.codigo.toLowerCase())
      );
      if (matchedCliente) {
        setSelectedClienteId(matchedCliente.id);
      }
    }
  }, [open, clientes, emailFrom]);

  const handleParse = async () => {
    setParsing(true);
    setError(null);
    setParsedOrder(null);

    try {
      const { data, error } = await supabase.functions.invoke("parse-order-email", {
        body: {
          emailBody,
          emailSubject,
          emailFrom,
          clienteId: selectedClienteId,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setParsedOrder(data.order);

      // Try to match products with existing products
      if (data.order && productos) {
        const matchedOrder = { ...data.order };
        matchedOrder.sucursales = matchedOrder.sucursales.map((suc: ParsedSucursal) => ({
          ...suc,
          productos: suc.productos.map((prod: ParsedProduct) => {
            const matched = productos.find(p => 
              p.nombre.toLowerCase().includes(prod.nombre_producto.toLowerCase()) ||
              prod.nombre_producto.toLowerCase().includes(p.nombre.toLowerCase())
            );
            return {
              ...prod,
              producto_id: matched?.id,
              precio_unitario: matched?.precio_venta || prod.precio_sugerido,
            };
          }),
        }));
        setParsedOrder(matchedOrder);
      }

      toast({
        title: "Correo procesado",
        description: `Se detectaron ${data.order.sucursales.length} sucursal(es) con productos`,
      });
    } catch (err: any) {
      console.error("Error parsing:", err);
      setError(err.message || "Error al procesar el correo");
      toast({
        title: "Error",
        description: err.message || "No se pudo procesar el correo",
        variant: "destructive",
      });
    } finally {
      setParsing(false);
    }
  };

  const handleCreateOrders = async () => {
    if (!parsedOrder || !selectedClienteId) return;

    setCreating(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuario no autenticado");

      let ordersCreated = 0;

      for (const suc of parsedOrder.sucursales) {
        // Skip sucursales without products
        const validProducts = suc.productos.filter(p => p.producto_id && p.cantidad > 0);
        if (validProducts.length === 0) continue;

        // Calculate totals
        const subtotal = validProducts.reduce((sum, p) => 
          sum + (p.cantidad * (p.precio_unitario || 0)), 0
        );
        const impuestos = subtotal * 0.16;
        const total = subtotal + impuestos;

        // Generate folio
        const currentDate = new Date();
        const yearMonth = `${currentDate.getFullYear()}${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        const { data: lastPedido } = await supabase
          .from("pedidos")
          .select("folio")
          .like("folio", `PED-${yearMonth}-%`)
          .order("folio", { ascending: false })
          .limit(1)
          .single();

        let nextNumber = 1;
        if (lastPedido?.folio) {
          const lastNum = parseInt(lastPedido.folio.split('-')[2], 10);
          nextNumber = lastNum + 1;
        }
        const folio = `PED-${yearMonth}-${String(nextNumber).padStart(4, '0')}`;

        // Create pedido
        const { data: pedido, error: pedidoError } = await supabase
          .from("pedidos")
          .insert({
            folio,
            cliente_id: selectedClienteId,
            sucursal_id: suc.sucursal_id || null,
            vendedor_id: userData.user.id,
            fecha_pedido: new Date().toISOString().split('T')[0],
            fecha_entrega_estimada: suc.fecha_entrega_solicitada || null,
            subtotal,
            impuestos,
            total,
            status: "pendiente",
            notas: parsedOrder.notas_generales 
              ? `[Desde correo] ${parsedOrder.notas_generales}` 
              : `[Procesado desde correo: ${emailSubject}]`,
          })
          .select()
          .single();

        if (pedidoError) throw pedidoError;

        // Create pedido detalles
        const detalles = validProducts.map(p => ({
          pedido_id: pedido.id,
          producto_id: p.producto_id!,
          cantidad: p.cantidad,
          precio_unitario: p.precio_unitario || 0,
          subtotal: p.cantidad * (p.precio_unitario || 0),
        }));

        const { error: detallesError } = await supabase
          .from("pedidos_detalles")
          .insert(detalles);

        if (detallesError) throw detallesError;

        ordersCreated++;
      }

      toast({
        title: "Pedidos creados",
        description: `Se crearon ${ordersCreated} pedido(s) exitosamente`,
      });

      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      console.error("Error creating orders:", err);
      toast({
        title: "Error",
        description: err.message || "No se pudieron crear los pedidos",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const updateProductMatch = (sucIndex: number, prodIndex: number, productoId: string) => {
    if (!parsedOrder) return;
    
    const producto = productos?.find(p => p.id === productoId);
    const updated = { ...parsedOrder };
    updated.sucursales[sucIndex].productos[prodIndex].producto_id = productoId;
    updated.sucursales[sucIndex].productos[prodIndex].precio_unitario = producto?.precio_venta;
    setParsedOrder(updated);
  };

  const updateProductQuantity = (sucIndex: number, prodIndex: number, cantidad: number) => {
    if (!parsedOrder) return;
    const updated = { ...parsedOrder };
    updated.sucursales[sucIndex].productos[prodIndex].cantidad = cantidad;
    setParsedOrder(updated);
  };

  const updateProductPrice = (sucIndex: number, prodIndex: number, precio: number) => {
    if (!parsedOrder) return;
    const updated = { ...parsedOrder };
    updated.sucursales[sucIndex].productos[prodIndex].precio_unitario = precio;
    setParsedOrder(updated);
  };

  const removeProduct = (sucIndex: number, prodIndex: number) => {
    if (!parsedOrder) return;
    const updated = { ...parsedOrder };
    updated.sucursales[sucIndex].productos.splice(prodIndex, 1);
    setParsedOrder(updated);
  };

  const updateSucursalMatch = (sucIndex: number, sucursalId: string) => {
    if (!parsedOrder) return;
    const updated = { ...parsedOrder };
    updated.sucursales[sucIndex].sucursal_id = sucursalId;
    setParsedOrder(updated);
  };

  const hasUnmatchedProducts = parsedOrder?.sucursales.some(s => 
    s.productos.some(p => !p.producto_id)
  );

  const totalProducts = parsedOrder?.sucursales.reduce((sum, s) => 
    sum + s.productos.filter(p => p.producto_id).length, 0
  ) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Procesar Pedido desde Correo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cliente selector */}
          <div className="space-y-2">
            <Label>Cliente</Label>
            <Select value={selectedClienteId} onValueChange={setSelectedClienteId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona el cliente" />
              </SelectTrigger>
              <SelectContent>
                {clientes?.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.codigo} - {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Parse button */}
          {!parsedOrder && (
            <Button 
              onClick={handleParse} 
              disabled={parsing || !selectedClienteId}
              className="w-full"
            >
              {parsing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analizando correo con IA...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Analizar Correo
                </>
              )}
            </Button>
          )}

          {/* Error display */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Parsed results */}
          {parsedOrder && (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {/* Confidence badge */}
                <div className="flex items-center gap-2">
                  <Badge variant={parsedOrder.confianza > 0.7 ? "default" : "secondary"}>
                    Confianza: {Math.round(parsedOrder.confianza * 100)}%
                  </Badge>
                  {hasUnmatchedProducts && (
                    <Badge variant="destructive">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Productos sin coincidencia
                    </Badge>
                  )}
                </div>

                {/* Sucursales */}
                {parsedOrder.sucursales.map((suc, sucIndex) => (
                  <Card key={sucIndex}>
                    <CardHeader className="py-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        {suc.nombre_sucursal}
                      </CardTitle>
                      {sucursales && sucursales.length > 0 && (
                        <Select 
                          value={suc.sucursal_id || ""} 
                          onValueChange={(v) => updateSucursalMatch(sucIndex, v)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Vincular a sucursal registrada..." />
                          </SelectTrigger>
                          <SelectContent>
                            {sucursales.map(s => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </CardHeader>
                    <CardContent className="py-2">
                      <div className="space-y-2">
                        {suc.productos.map((prod, prodIndex) => (
                          <div 
                            key={prodIndex} 
                            className="flex items-center gap-2 p-2 bg-muted/50 rounded-md"
                          >
                            <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                            
                            {/* Product selector */}
                            <Select
                              value={prod.producto_id || ""}
                              onValueChange={(v) => updateProductMatch(sucIndex, prodIndex, v)}
                            >
                              <SelectTrigger className="flex-1 min-w-[200px]">
                                <SelectValue placeholder={prod.nombre_producto} />
                              </SelectTrigger>
                              <SelectContent>
                                {productos?.map(p => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.codigo} - {p.nombre}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {/* Quantity */}
                            <Input
                              type="number"
                              value={prod.cantidad}
                              onChange={(e) => updateProductQuantity(sucIndex, prodIndex, parseFloat(e.target.value) || 0)}
                              className="w-20"
                            />
                            <span className="text-sm text-muted-foreground w-12">
                              {prod.unidad}
                            </span>

                            {/* Price */}
                            <div className="flex items-center gap-1">
                              <span className="text-sm text-muted-foreground">$</span>
                              <Input
                                type="number"
                                value={prod.precio_unitario || ""}
                                onChange={(e) => updateProductPrice(sucIndex, prodIndex, parseFloat(e.target.value) || 0)}
                                className="w-24"
                                placeholder="Precio"
                              />
                            </div>

                            {/* Status indicator */}
                            {prod.producto_id ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                            )}

                            {/* Remove button */}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeProduct(sucIndex, prodIndex)}
                              className="h-8 w-8 shrink-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Notes */}
                {parsedOrder.notas_generales && (
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-sm text-muted-foreground">
                      <strong>Notas:</strong> {parsedOrder.notas_generales}
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        <Separator />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {parsedOrder && (
            <Button
              onClick={handleCreateOrders}
              disabled={creating || totalProducts === 0}
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creando pedidos...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Crear {parsedOrder.sucursales.length} Pedido(s)
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
