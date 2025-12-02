import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LotesDesglose } from "@/components/productos/LotesDesglose";
import { NotificacionesSistema } from "@/components/NotificacionesSistema";
import { ScrollArea } from "@/components/ui/scroll-area";

const Productos = () => {
  const [productos, setProductos] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [tabActivo, setTabActivo] = useState<"activos" | "inactivos">("activos");
  const [codigoGapWarning, setCodigoGapWarning] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [similarNameSuggestion, setSimilarNameSuggestion] = useState<{ suggestedName: string; codigo: string } | null>(null);
  const { toast } = useToast();

  // Función para normalizar texto (quitar acentos y convertir a minúsculas)
  const normalizeText = (text: string): string => {
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  };

  // Función para verificar si existe un producto con nombre similar (ignorando acentos)
  const checkSimilarProductName = (nombre: string): { suggestedName: string; codigo: string } | null => {
    if (!nombre || nombre.trim().length < 3) return null;
    
    const normalizedInput = normalizeText(nombre);
    
    const similar = productos.find(p => {
      if (editingProduct && p.id === editingProduct.id) return false;
      const normalizedExisting = normalizeText(p.nombre || '');
      // Verificar si son similares (ignorando acentos) pero diferentes textualmente
      return normalizedExisting === normalizedInput && 
             (p.nombre || '').trim().toLowerCase() !== nombre.trim().toLowerCase();
    });

    if (similar) {
      return { suggestedName: similar.nombre, codigo: similar.codigo };
    }
    return null;
  };

  // Aplicar la sugerencia de nombre
  const applySuggestedName = () => {
    if (similarNameSuggestion) {
      setFormData({ ...formData, nombre: similarNameSuggestion.suggestedName });
      setSimilarNameSuggestion(null);
    }
  };

  // Descartar la sugerencia (el usuario confirma que su escritura es correcta)
  const dismissSuggestion = () => {
    setSimilarNameSuggestion(null);
  };

  // Función para obtener el siguiente código disponible basado en un prefijo
  const getNextAvailableCodeForPrefix = (prefix: string): string | null => {
    if (!prefix) return null;
    
    // Normalizar el prefijo (remover guiones/espacios al final para la búsqueda)
    const cleanPrefix = prefix.replace(/[-_\s]+$/, '');
    const separator = prefix.match(/[-_\s]+$/)?.[0] || '-';
    
    // Buscar todos los códigos que empiezan con este prefijo
    const matchingCodes = productos
      .map(p => {
        // Buscar patrón: PREFIJO-XXX o PREFIJO_XXX donde XXX son números
        const regex = new RegExp(`^${cleanPrefix}[-_\\s]*(\\d+)$`, 'i');
        const match = p.codigo.match(regex);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter(n => n !== null) as number[];
    
    if (matchingCodes.length === 0) {
      // Es el primer producto con este prefijo
      return `${cleanPrefix}${separator}001`;
    }
    
    // Determinar el padding basado en códigos existentes
    const existingCode = productos.find(p => p.codigo.toLowerCase().startsWith(cleanPrefix.toLowerCase()));
    const numMatch = existingCode?.codigo.match(/(\d+)$/);
    const padLength = numMatch ? numMatch[1].length : 3;
    
    // Buscar huecos en la secuencia
    const sortedNumbers = [...new Set(matchingCodes)].sort((a, b) => a - b);
    
    for (let i = 1; i <= sortedNumbers[sortedNumbers.length - 1]; i++) {
      if (!sortedNumbers.includes(i)) {
        return `${cleanPrefix}${separator}${i.toString().padStart(padLength, '0')}`;
      }
    }
    
    // Si no hay huecos, usar el siguiente número
    const nextNum = Math.max(...matchingCodes) + 1;
    return `${cleanPrefix}${separator}${nextNum.toString().padStart(padLength, '0')}`;
  };

  // Función para verificar huecos en la secuencia de códigos
  const checkCodigoGap = (codigo: string) => {
    if (!codigo) {
      setCodigoGapWarning(null);
      return;
    }

    // Extraer el número del código ingresado
    const numMatch = codigo.match(/(\d+)/);
    if (!numMatch) {
      setCodigoGapWarning(null);
      return;
    }

    const inputNum = parseInt(numMatch[1], 10);
    const prefix = codigo.slice(0, codigo.indexOf(numMatch[1]));
    const numLength = numMatch[1].length;

    // Obtener todos los códigos existentes con el mismo prefijo
    const existingCodes = productos
      .map(p => {
        const match = p.codigo.match(new RegExp(`^${prefix}(\\d{${numLength}})$`));
        return match ? parseInt(match[1], 10) : null;
      })
      .filter(n => n !== null) as number[];

    // Buscar huecos en la secuencia
    const missingCodes: string[] = [];
    for (let i = 1; i < inputNum; i++) {
      if (!existingCodes.includes(i)) {
        const paddedNum = i.toString().padStart(numLength, '0');
        missingCodes.push(`${prefix}${paddedNum}`);
      }
    }

    if (missingCodes.length > 0) {
      const displayCodes = missingCodes.length <= 3 
        ? missingCodes.join(", ") 
        : `${missingCodes.slice(0, 3).join(", ")}... (${missingCodes.length} códigos faltantes)`;
      setCodigoGapWarning(`Códigos faltantes: ${displayCodes}`);
    } else {
      setCodigoGapWarning(null);
    }
  };

  // Función para verificar productos duplicados (ahora también compara sin acentos)
  const checkDuplicateProduct = (nombre: string, marca: string, presentacion: string, unidad: string): string | null => {
    const normalizedNombre = normalizeText(nombre);
    const normalizedMarca = normalizeText(marca || '');
    const normalizedPresentacion = (presentacion || '').trim();
    const normalizedUnidad = unidad;

    const duplicate = productos.find(p => {
      // Si estamos editando, excluir el producto actual
      if (editingProduct && p.id === editingProduct.id) return false;

      const pNombre = normalizeText(p.nombre || '');
      const pMarca = normalizeText(p.marca || '');
      const pPresentacion = (p.presentacion || '').trim();
      const pUnidad = p.unidad;

      // Es duplicado si coinciden nombre, marca, presentación Y unidad (ignorando acentos)
      return pNombre === normalizedNombre &&
             pMarca === normalizedMarca &&
             pPresentacion === normalizedPresentacion &&
             pUnidad === normalizedUnidad;
    });

    if (duplicate) {
      return `Ya existe un producto con estas características: "${duplicate.nombre}" (${duplicate.codigo})`;
    }
    return null;
  };

  const [formData, setFormData] = useState<{
    codigo: string;
    codigo_sat: string;
    nombre: string;
    marca: string;
    categoria: string;
    presentacion: string;
    unidad: "bulto" | "caja" | "churla" | "costal" | "cubeta" | "kg" | "litro" | "pieza" | "balón";
    precio_por_kilo: boolean;
    kg_por_unidad: string;
    precio_venta: string;
    precio_compra: string;
    stock_minimo: string;
    maneja_caducidad: boolean;
    aplica_iva: boolean;
    aplica_ieps: boolean;
    activo: boolean;
    requiere_fumigacion: boolean;
    fecha_ultima_fumigacion: string;
    fecha_caducidad_inicial: string;
    stock_inicial: string;
    proveedor_id: string;
  }>({
    codigo: "",
    codigo_sat: "",
    nombre: "",
    marca: "",
    categoria: "",
    presentacion: "",
    unidad: "bulto",
    precio_por_kilo: false,
    kg_por_unidad: "",
    precio_venta: "",
    precio_compra: "",
    stock_minimo: "",
    maneja_caducidad: false,
    aplica_iva: false,
    aplica_ieps: false,
    activo: true,
    requiere_fumigacion: false,
    fecha_ultima_fumigacion: "",
    fecha_caducidad_inicial: "",
    stock_inicial: "",
    proveedor_id: "",
  });

  useEffect(() => {
    loadProductos();
    loadProveedores();
  }, []);

  const loadProveedores = async () => {
    try {
      const { data, error } = await supabase
        .from("proveedores")
        .select("id, nombre")
        .eq("activo", true)
        .order("nombre");

      if (error) throw error;
      setProveedores(data || []);
    } catch (error: any) {
      console.error("Error loading proveedores:", error);
    }
  };

  const loadProductos = async () => {
    try {
      const { data, error } = await supabase
        .from("productos")
        .select(`
          *,
          proveedores:proveedor_preferido_id (
            id,
            nombre
          )
        `)
        .order("codigo");

      if (error) throw error;
      setProductos(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los productos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };


  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Verificar producto duplicado
    const duplicateError = checkDuplicateProduct(formData.nombre, formData.marca, formData.presentacion, formData.unidad);
    if (duplicateError) {
      setDuplicateWarning(duplicateError);
      toast({
        title: "Producto duplicado",
        description: duplicateError,
        variant: "destructive",
      });
      return;
    }
    
    try {
      const productData = {
        codigo: formData.codigo,
        codigo_sat: formData.codigo_sat || null,
        nombre: formData.nombre,
        marca: formData.marca || null,
        categoria: formData.categoria || null,
        presentacion: formData.presentacion || null,
        unidad: formData.unidad,
        precio_por_kilo: formData.precio_por_kilo,
        kg_por_unidad: formData.kg_por_unidad ? parseFloat(formData.kg_por_unidad) : null,
        precio_venta: parseFloat(formData.precio_venta),
        precio_compra: parseFloat(formData.precio_compra) || 0,
        stock_minimo: parseInt(formData.stock_minimo),
        maneja_caducidad: formData.maneja_caducidad,
        aplica_iva: formData.aplica_iva,
        aplica_ieps: formData.aplica_ieps,
        activo: formData.activo,
        requiere_fumigacion: formData.requiere_fumigacion,
        fecha_ultima_fumigacion: formData.fecha_ultima_fumigacion || null,
      };

      if (editingProduct) {
        const { error } = await supabase
          .from("productos")
          .update(productData)
          .eq("id", editingProduct.id);

        if (error) throw error;

        // Si se agregó stock, crear un nuevo lote
        const stockAgregar = parseInt(formData.stock_inicial) || 0;
        if (stockAgregar > 0) {
          const loteData: any = {
            producto_id: editingProduct.id,
            cantidad_disponible: stockAgregar,
            precio_compra: parseFloat(formData.precio_compra) || 0,
            lote_referencia: "Carga inicial",
          };
          
          if (formData.maneja_caducidad && formData.fecha_caducidad_inicial) {
            loteData.fecha_caducidad = formData.fecha_caducidad_inicial;
          }

          const { error: loteError } = await supabase
            .from("inventario_lotes")
            .insert([loteData]);

          if (loteError) {
            console.error("Error creando lote:", loteError);
          } else {
            // Actualizar stock_actual del producto
            await supabase
              .from("productos")
              .update({ stock_actual: (editingProduct.stock_actual || 0) + stockAgregar })
              .eq("id", editingProduct.id);
          }
        }

        toast({ title: "Producto actualizado correctamente" });
      } else {
        const { data: newProduct, error } = await supabase
          .from("productos")
          .insert([productData])
          .select()
          .single();

        if (error) throw error;

        // Si se seleccionó un proveedor, crear la relación en proveedor_productos
        if (formData.proveedor_id && newProduct) {
          const { error: provError } = await supabase
            .from("proveedor_productos")
            .insert([{
              proveedor_id: formData.proveedor_id,
              producto_id: newProduct.id
            }]);
          
          if (provError) {
            console.error("Error asociando proveedor:", provError);
          }
        }

        // Si tiene stock inicial y fecha de caducidad, crear el lote inicial
        const stockInicial = parseInt(formData.stock_inicial) || 0;
        if (stockInicial > 0 && newProduct) {
          const loteData: any = {
            producto_id: newProduct.id,
            cantidad_disponible: stockInicial,
            precio_compra: parseFloat(formData.precio_compra) || 0,
            lote_referencia: "Lote inicial",
          };
          
          if (formData.maneja_caducidad && formData.fecha_caducidad_inicial) {
            loteData.fecha_caducidad = formData.fecha_caducidad_inicial;
          }

          const { error: loteError } = await supabase
            .from("inventario_lotes")
            .insert([loteData]);

          if (loteError) {
            console.error("Error creando lote inicial:", loteError);
          }

          // Actualizar stock_actual del producto
          await supabase
            .from("productos")
            .update({ stock_actual: stockInicial })
            .eq("id", newProduct.id);
        }

        toast({ title: "Producto creado correctamente" });
      }

      setDialogOpen(false);
      resetForm();
      loadProductos();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    setFormData({
      codigo: product.codigo,
      codigo_sat: product.codigo_sat || "",
      nombre: product.nombre,
      marca: product.marca || "",
      categoria: product.categoria || "",
      presentacion: product.presentacion || "",
      unidad: product.unidad,
      precio_por_kilo: product.precio_por_kilo || false,
      kg_por_unidad: product.kg_por_unidad?.toString() || "",
      precio_venta: product.precio_venta.toString(),
      precio_compra: product.precio_compra.toString(),
      stock_minimo: product.stock_minimo.toString(),
      maneja_caducidad: product.maneja_caducidad,
      aplica_iva: product.aplica_iva || false,
      aplica_ieps: product.aplica_ieps || false,
      activo: product.activo !== false,
      requiere_fumigacion: product.requiere_fumigacion || false,
      fecha_ultima_fumigacion: product.fecha_ultima_fumigacion || "",
      fecha_caducidad_inicial: "",
      stock_inicial: "",
      proveedor_id: "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este producto?")) return;

    try {
      const { error } = await supabase
        .from("productos")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Producto eliminado" });
      loadProductos();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setEditingProduct(null);
    setCodigoGapWarning(null);
    setDuplicateWarning(null);
    setSimilarNameSuggestion(null);
    setFormData({
      codigo: "",
      codigo_sat: "",
      nombre: "",
      marca: "",
      categoria: "",
      presentacion: "",
      unidad: "bulto",
      precio_por_kilo: false,
      kg_por_unidad: "",
      precio_venta: "",
      precio_compra: "",
      stock_minimo: "",
      maneja_caducidad: false,
      aplica_iva: false,
      aplica_ieps: false,
      activo: true,
      requiere_fumigacion: false,
      fecha_ultima_fumigacion: "",
      fecha_caducidad_inicial: "",
      stock_inicial: "",
      proveedor_id: "",
    });
  };

  const filteredProductos = productos.filter((p) => {
    const matchesSearch = 
      p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.marca && p.marca.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.presentacion && p.presentacion.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesActiveFilter = tabActivo === "inactivos" ? p.activo === false : p.activo !== false;
    
    return matchesSearch && matchesActiveFilter;
  });

  const productosActivos = productos.filter(p => p.activo !== false).length;
  const productosInactivos = productos.filter(p => p.activo === false).length;

  const calcularPrecioTotal = () => {
    if (!formData.precio_por_kilo || !formData.precio_venta || !formData.presentacion) {
      return null;
    }
    const precioUnitario = parseFloat(formData.precio_venta);
    const kilos = parseFloat(formData.presentacion);
    if (isNaN(precioUnitario) || isNaN(kilos)) return null;
    return (precioUnitario * kilos).toFixed(2);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <NotificacionesSistema />
        
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Productos</h1>
            <p className="text-muted-foreground">Gestión de catálogo de productos</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Producto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingProduct ? "Editar Producto" : "Nuevo Producto"}
                </DialogTitle>
                <DialogDescription>
                  Completa la información del producto
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="flex items-center space-x-2 p-3 bg-muted rounded-lg">
                  <input
                    type="checkbox"
                    id="activo"
                    checked={formData.activo}
                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="activo" className="cursor-pointer">
                    Producto activo
                  </Label>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="codigo">Código *</Label>
                    <Input
                      id="codigo"
                      value={formData.codigo}
                      onChange={(e) => {
                        const value = e.target.value;
                        
                        // Si el usuario escribe un prefijo seguido de guión/espacio, sugerir el siguiente código
                        if (value.match(/^[a-zA-Z]+[-_\s]$/) && !editingProduct) {
                          const suggestion = getNextAvailableCodeForPrefix(value);
                          if (suggestion) {
                            setFormData({ ...formData, codigo: suggestion });
                            checkCodigoGap(suggestion);
                            return;
                          }
                        }
                        
                        setFormData({ ...formData, codigo: value });
                        checkCodigoGap(value);
                      }}
                      required
                      autoComplete="off"
                      placeholder="Ej: NFS-001, VEL-001"
                    />
                    {codigoGapWarning && !editingProduct && (
                      <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                        ⚠️ {codigoGapWarning}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="codigo_sat">Código SAT</Label>
                    <Input
                      id="codigo_sat"
                      value={formData.codigo_sat}
                      onChange={(e) => setFormData({ ...formData, codigo_sat: e.target.value })}
                      placeholder="Ej: 10121500"
                      autoComplete="off"
                    />
                    <p className="text-xs text-muted-foreground">
                      Para facturación CFDI
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unidad">Unidad *</Label>
                    <Select
                      value={formData.unidad}
                      onValueChange={(value: "bulto" | "caja" | "churla" | "costal" | "cubeta" | "kg" | "litro" | "pieza" | "balón") => {
                        const newFormData = { ...formData, unidad: value };
                        setFormData(newFormData);
                        setDuplicateWarning(checkDuplicateProduct(newFormData.nombre, newFormData.marca, newFormData.presentacion, value));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="balón">Balón</SelectItem>
                        <SelectItem value="bulto">Bulto</SelectItem>
                        <SelectItem value="caja">Caja</SelectItem>
                        <SelectItem value="churla">Churla</SelectItem>
                        <SelectItem value="costal">Costal</SelectItem>
                        <SelectItem value="cubeta">Cubeta</SelectItem>
                        <SelectItem value="kg">Kg</SelectItem>
                        <SelectItem value="litro">Litro</SelectItem>
                        <SelectItem value="pieza">Pieza</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nombre">Descripción del Producto *</Label>
                  <Input
                    id="nombre"
                    value={formData.nombre}
                    onChange={(e) => {
                      const nombre = e.target.value;
                      setFormData({ ...formData, nombre });
                      setDuplicateWarning(checkDuplicateProduct(nombre, formData.marca, formData.presentacion, formData.unidad));
                      setSimilarNameSuggestion(checkSimilarProductName(nombre));
                    }}
                    required
                    autoComplete="off"
                    spellCheck={true}
                    lang="es-MX"
                    list="nombres-existentes"
                    placeholder="Ej: Alpiste, Azúcar, Frijol"
                  />
                  <datalist id="nombres-existentes">
                    {[...new Set(productos.map(p => p.nombre).filter(Boolean))].sort().map((nom) => (
                      <option key={nom} value={nom} />
                    ))}
                  </datalist>
                  {similarNameSuggestion && (
                    <div className="flex items-center justify-between text-xs bg-amber-50 p-2 rounded border border-amber-200">
                      <span className="text-amber-700">
                        💡 ¿Quisiste decir "<strong>{similarNameSuggestion.suggestedName}</strong>"? ({similarNameSuggestion.codigo})
                      </span>
                      <div className="flex gap-2 ml-2">
                        <button
                          type="button"
                          onClick={applySuggestedName}
                          className="text-green-600 hover:text-green-800 hover:bg-green-100 p-1 rounded"
                          title="Usar esta sugerencia"
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          onClick={dismissSuggestion}
                          className="text-red-600 hover:text-red-800 hover:bg-red-100 p-1 rounded"
                          title="Ignorar, mi escritura es correcta"
                        >
                          ✗
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="marca">Marca</Label>
                    <Input
                      id="marca"
                      value={formData.marca}
                      onChange={(e) => {
                        const marca = e.target.value;
                        setFormData({ ...formData, marca });
                        setDuplicateWarning(checkDuplicateProduct(formData.nombre, marca, formData.presentacion, formData.unidad));
                      }}
                      placeholder="Ej: Morelos, Purina"
                      autoComplete="off"
                      spellCheck={true}
                      lang="es-MX"
                      list="marcas-existentes"
                    />
                    <datalist id="marcas-existentes">
                      {[...new Set(productos.map(p => p.marca).filter(Boolean))].sort().map((m) => (
                        <option key={m} value={m} />
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="categoria">Categoría (para agrupar)</Label>
                    <Input
                      id="categoria"
                      value={formData.categoria}
                      onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                      placeholder="Ej: Arándano, Uva Pasa, Arroz"
                      list="categorias-existentes"
                      spellCheck={true}
                      lang="es-MX"
                    />
                    <datalist id="categorias-existentes">
                      {[...new Set(productos.map(p => p.categoria).filter(Boolean))].sort().map((cat) => (
                        <option key={cat} value={cat} />
                      ))}
                    </datalist>
                    <p className="text-xs text-muted-foreground">
                      Agrupa productos de diferentes marcas
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="presentacion">Presentación (Kilos) *</Label>
                    <Input
                      id="presentacion"
                      type="number"
                      step="0.01"
                      value={formData.presentacion}
                      onChange={(e) => {
                        const presentacion = e.target.value;
                        setFormData({ ...formData, presentacion });
                        setDuplicateWarning(checkDuplicateProduct(formData.nombre, formData.marca, presentacion, formData.unidad));
                      }}
                      placeholder="Ej: 25, 50"
                      autoComplete="off"
                      required
                    />
                  </div>
                  {!editingProduct && (
                    <div className="space-y-2">
                      <Label htmlFor="proveedor">Proveedor</Label>
                      <Select
                        value={formData.proveedor_id}
                        onValueChange={(value) => setFormData({ ...formData, proveedor_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar proveedor (opcional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {proveedores.map((prov) => (
                            <SelectItem key={prov.id} value={prov.id}>
                              {prov.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Se asociará automáticamente al proveedor
                      </p>
                    </div>
                  )}
                </div>
                
                {duplicateWarning && (
                  <p className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
                    ❌ {duplicateWarning}
                  </p>
                )}
                
                <div className="flex items-center gap-4 p-3 bg-muted rounded-md">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="precio_por_kilo"
                      checked={formData.precio_por_kilo}
                      onChange={(e) => setFormData({ ...formData, precio_por_kilo: e.target.checked })}
                      className="rounded"
                    />
                    <Label htmlFor="precio_por_kilo" className="cursor-pointer">
                      Precio por kilo
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="kg_por_unidad" className="text-sm whitespace-nowrap">
                      Kg por unidad:
                    </Label>
                    <Input
                      id="kg_por_unidad"
                      type="number"
                      step="0.01"
                      value={formData.kg_por_unidad}
                      onChange={(e) => setFormData({ ...formData, kg_por_unidad: e.target.value })}
                      placeholder="ej: 5"
                      className="w-24"
                    />
                    {formData.kg_por_unidad && (
                      <span className="text-xs text-muted-foreground">
                        (para conversión en compras)
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="precio_compra">Precio Compra</Label>
                    <Input
                      id="precio_compra"
                      type="number"
                      step="0.01"
                      value={formData.precio_compra}
                      onChange={(e) => setFormData({ ...formData, precio_compra: e.target.value })}
                      placeholder="0.00"
                      autoComplete="off"
                    />
                    <p className="text-xs text-muted-foreground">
                      Se actualizará desde Compras
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="precio_venta">
                      {formData.precio_por_kilo ? "Precio por Kilo *" : "Precio Venta *"}
                    </Label>
                    <Input
                      id="precio_venta"
                      type="number"
                      step="0.01"
                      value={formData.precio_venta}
                      onChange={(e) => setFormData({ ...formData, precio_venta: e.target.value })}
                      required
                      autoComplete="off"
                    />
                    {formData.precio_por_kilo && calcularPrecioTotal() && (
                      <p className="text-xs text-primary font-medium">
                        Total del {formData.unidad}: ${calcularPrecioTotal()}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stock_minimo">Stock Mínimo *</Label>
                    <Input
                      id="stock_minimo"
                      type="number"
                      value={formData.stock_minimo}
                      onChange={(e) => setFormData({ ...formData, stock_minimo: e.target.value })}
                      required
                      autoComplete="off"
                    />
                  </div>
                </div>
                <div className="space-y-3 p-3 bg-muted/50 rounded-lg border">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="maneja_caducidad"
                      checked={formData.maneja_caducidad}
                      onChange={(e) => setFormData({ ...formData, maneja_caducidad: e.target.checked })}
                      className="rounded"
                    />
                    <Label htmlFor="maneja_caducidad">Maneja fecha de caducidad</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-border/50">
                    <div className="space-y-2">
                      <Label htmlFor="stock_inicial">
                        {editingProduct ? "Agregar stock" : "Stock inicial"}
                      </Label>
                      <Input
                        id="stock_inicial"
                        type="number"
                        value={formData.stock_inicial}
                        onChange={(e) => setFormData({ ...formData, stock_inicial: e.target.value })}
                        placeholder="0"
                        autoComplete="off"
                      />
                      <p className="text-xs text-muted-foreground">
                        {editingProduct 
                          ? "Cantidad a agregar (creará un nuevo lote)" 
                          : "Cantidad que ya tienes en bodega"}
                      </p>
                    </div>
                    {formData.maneja_caducidad && (
                      <div className="space-y-2">
                        <Label htmlFor="fecha_caducidad_inicial">Fecha de caducidad</Label>
                        <Input
                          id="fecha_caducidad_inicial"
                          type="date"
                          value={formData.fecha_caducidad_inicial}
                          onChange={(e) => setFormData({ ...formData, fecha_caducidad_inicial: e.target.value })}
                          autoComplete="off"
                        />
                        <p className="text-xs text-muted-foreground">
                          Fecha de vencimiento del stock
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-3 p-3 bg-muted/50 rounded-lg border">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="requiere_fumigacion"
                      checked={formData.requiere_fumigacion}
                      onChange={(e) => setFormData({ ...formData, requiere_fumigacion: e.target.checked })}
                      className="rounded"
                    />
                    <Label htmlFor="requiere_fumigacion">Requiere fumigación cada 6 meses</Label>
                  </div>
                  {formData.requiere_fumigacion && (
                    <div className="space-y-2 ml-6">
                      <Label htmlFor="fecha_ultima_fumigacion">Fecha de última fumigación (opcional)</Label>
                      <Input
                        id="fecha_ultima_fumigacion"
                        type="date"
                        value={formData.fecha_ultima_fumigacion}
                        onChange={(e) => setFormData({ ...formData, fecha_ultima_fumigacion: e.target.value })}
                        autoComplete="off"
                      />
                      <p className="text-xs text-muted-foreground">
                        Si no se sabe, se registrará al recibir el producto en inventario
                      </p>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="aplica_iva"
                      checked={formData.aplica_iva}
                      onChange={(e) => setFormData({ ...formData, aplica_iva: e.target.checked })}
                      className="rounded"
                    />
                    <Label htmlFor="aplica_iva">Precio incluye IVA (16%)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="aplica_ieps"
                      checked={formData.aplica_ieps}
                      onChange={(e) => setFormData({ ...formData, aplica_ieps: e.target.checked })}
                      className="rounded"
                    />
                    <Label htmlFor="aplica_ieps">Precio incluye IEPS (8%)</Label>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">Guardar</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-4 items-center mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Tabs value={tabActivo} onValueChange={(value) => setTabActivo(value as "activos" | "inactivos")}>
          <TabsList>
            <TabsTrigger value="activos">
              Activos ({productosActivos})
            </TabsTrigger>
            <TabsTrigger value="inactivos">
              Inactivos ({productosInactivos})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={tabActivo} className="mt-4">
            <div className="border rounded-lg">
              <ScrollArea className="h-[calc(100vh-330px)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead>Presentación</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center">
                      Cargando...
                    </TableCell>
                  </TableRow>
                ) : filteredProductos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center">
                      No hay productos registrados
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProductos.map((producto) => {
                    const precioMostrar = producto.precio_por_kilo && producto.presentacion
                      ? `$${producto.precio_venta.toFixed(2)}/kg ($${(producto.precio_venta * parseFloat(producto.presentacion)).toFixed(2)})`
                      : `$${producto.precio_venta.toFixed(2)}`;
                    
                    return (
                      <TableRow key={producto.id} className={producto.activo === false ? "opacity-50" : ""}>
                        <TableCell className="font-medium">
                          {producto.codigo}
                          {producto.activo === false && (
                            <Badge variant="secondary" className="ml-2 text-xs">Inactivo</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 flex-wrap">
                            <span>{producto.nombre}</span>
                            {producto.aplica_iva && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-blue-50 text-blue-700 border-blue-200">
                                IVA
                              </Badge>
                            )}
                            {producto.aplica_ieps && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-amber-50 text-amber-700 border-amber-200">
                                IEPS
                              </Badge>
                            )}
                            {producto.maneja_caducidad && <span className="ml-1">📅</span>}
                            {producto.requiere_fumigacion && <span>🦠</span>}
                          </div>
                        </TableCell>
                        <TableCell>{producto.marca || "-"}</TableCell>
                        <TableCell>{producto.presentacion ? `${producto.presentacion} kg` : "-"}</TableCell>
                        <TableCell className="uppercase">{producto.unidad}</TableCell>
                        <TableCell className="font-medium">{precioMostrar}</TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            {producto.stock_actual === 0 ? (
                              <Badge variant="destructive" className="text-xs">
                                Sin Stock
                              </Badge>
                            ) : (
                              <Badge variant={producto.stock_actual <= producto.stock_minimo ? "destructive" : "default"}>
                                {producto.stock_actual}
                              </Badge>
                            )}
                            <LotesDesglose
                              productoId={producto.id}
                              productoNombre={producto.nombre}
                              stockTotal={producto.stock_actual}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(producto)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(producto.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Productos;