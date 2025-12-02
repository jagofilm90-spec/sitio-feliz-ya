import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import GoogleMapsAddressAutocomplete from "@/components/GoogleMapsAddressAutocomplete";
import { Plus, X, Mail, MapPin, Truck, Loader2, Sparkles } from "lucide-react";

interface Zona {
  id: string;
  nombre: string;
}

interface SucursalForm {
  id: string;
  nombre: string;
  direccion: string;
  zona_id: string;
  telefono: string;
  contacto: string;
}

interface CorreoForm {
  id: string;
  email: string;
  nombre_contacto: string;
  proposito: string;
  es_principal: boolean;
  isNew?: boolean;
}

interface ClienteFormContentProps {
  formData: {
    codigo: string;
    nombre: string;
    razon_social: string;
    rfc: string;
    direccion: string;
    telefono: string;
    email: string;
    termino_credito: "contado" | "8_dias" | "15_dias" | "30_dias";
    limite_credito: string;
    zona_id: string;
    preferencia_facturacion: "siempre_factura" | "siempre_remision" | "variable";
    regimen_capital: string;
    codigo_postal: string;
    tipo_vialidad: string;
    nombre_vialidad: string;
    numero_exterior: string;
    numero_interior: string;
    nombre_colonia: string;
    nombre_localidad: string;
    nombre_municipio: string;
    nombre_entidad_federativa: string;
    entre_calle: string;
    y_calle: string;
    csf_archivo_url: string;
  };
  setFormData: (data: any) => void;
  zonas: Zona[];
  handleSave: (e: React.FormEvent) => void;
  editingClient: any;
  setDialogOpen: (open: boolean) => void;
  csfFile: File | null;
  setCsfFile: (file: File | null) => void;
  parsingCsf: boolean;
  handleParseCsf: (file: File) => void;
  entregarMismaDireccion: boolean;
  setEntregarMismaDireccion: (value: boolean) => void;
  sucursales: SucursalForm[];
  setSucursales: (sucursales: SucursalForm[]) => void;
  addSucursal: () => void;
  removeSucursal: (id: string) => void;
  updateSucursal: (id: string, field: keyof SucursalForm, value: string) => void;
  correos: CorreoForm[];
  setCorreos: (correos: CorreoForm[]) => void;
  newCorreoEmail: string;
  setNewCorreoEmail: (email: string) => void;
  newCorreoNombre: string;
  setNewCorreoNombre: (nombre: string) => void;
  handleAddCorreo: () => void;
  handleRemoveCorreo: (id: string) => void;
  handleSetPrincipal: (id: string) => void;
}

export function ClienteFormContent({
  formData,
  setFormData,
  zonas,
  handleSave,
  editingClient,
  setDialogOpen,
  csfFile,
  setCsfFile,
  parsingCsf,
  handleParseCsf,
  entregarMismaDireccion,
  setEntregarMismaDireccion,
  sucursales,
  addSucursal,
  removeSucursal,
  updateSucursal,
  correos,
  newCorreoEmail,
  setNewCorreoEmail,
  newCorreoNombre,
  setNewCorreoNombre,
  handleAddCorreo,
  handleRemoveCorreo,
  handleSetPrincipal,
}: ClienteFormContentProps) {
  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Datos de Identificación */}
      <div className="space-y-4">
        <h4 className="font-medium text-lg border-b pb-2">Datos de Identificación</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="codigo">Código *</Label>
            <Input
              id="codigo"
              value={formData.codigo}
              onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre Comercial *</Label>
            <Input
              id="nombre"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              required
            />
          </div>
        </div>
      </div>

      {/* Datos Fiscales */}
      <div className="space-y-4">
        <h4 className="font-medium text-lg border-b pb-2">Datos Fiscales</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="rfc">RFC</Label>
            <Input
              id="rfc"
              value={formData.rfc}
              onChange={(e) => setFormData({ ...formData, rfc: e.target.value.toUpperCase() })}
              placeholder="XAXX010101000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="razon_social">Razón Social</Label>
            <Input
              id="razon_social"
              value={formData.razon_social}
              onChange={(e) => setFormData({ ...formData, razon_social: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="regimen_capital">Régimen de Capital</Label>
          <Input
            id="regimen_capital"
            value={formData.regimen_capital}
            onChange={(e) => setFormData({ ...formData, regimen_capital: e.target.value })}
            placeholder="Ej: S.A. de C.V., S.C., etc."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="direccion">Dirección Fiscal</Label>
          <GoogleMapsAddressAutocomplete
            value={formData.direccion}
            onChange={(value) => setFormData({ ...formData, direccion: value })}
            placeholder="Buscar dirección fiscal..."
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="codigo_postal">C.P.</Label>
            <Input
              id="codigo_postal"
              value={formData.codigo_postal}
              onChange={(e) => setFormData({ ...formData, codigo_postal: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nombre_colonia">Colonia</Label>
            <Input
              id="nombre_colonia"
              value={formData.nombre_colonia}
              onChange={(e) => setFormData({ ...formData, nombre_colonia: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nombre_municipio">Municipio</Label>
            <Input
              id="nombre_municipio"
              value={formData.nombre_municipio}
              onChange={(e) => setFormData({ ...formData, nombre_municipio: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="zona_id">Zona de Entrega</Label>
          <Select
            value={formData.zona_id}
            onValueChange={(value) => setFormData({ ...formData, zona_id: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona una zona" />
            </SelectTrigger>
            <SelectContent>
              {zonas.map((zona) => (
                <SelectItem key={zona.id} value={zona.id}>
                  {zona.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* CSF Upload */}
        <div className="space-y-2">
          <Label>Constancia de Situación Fiscal (CSF)</Label>
          <div className="flex items-center gap-2">
            <Input
              type="file"
              accept=".pdf"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setCsfFile(file);
              }}
              className="flex-1"
            />
            {csfFile && (
              <>
                <Badge variant="secondary">{csfFile.name}</Badge>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleParseCsf(csfFile)}
                  disabled={parsingCsf}
                >
                  {parsingCsf ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Analizando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-1" />
                      Auto-llenar con AI
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Sube el PDF de la Constancia de Situación Fiscal del SAT. Usa "Auto-llenar con AI" para extraer los datos automáticamente.
          </p>
        </div>
      </div>

      {/* Datos Comerciales */}
      <div className="space-y-4">
        <h4 className="font-medium text-lg border-b pb-2">Datos Comerciales</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="telefono">Teléfono</Label>
            <Input
              id="telefono"
              value={formData.telefono}
              onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="termino_credito">Término de Crédito *</Label>
            <Select
              value={formData.termino_credito}
              onValueChange={(value: "contado" | "8_dias" | "15_dias" | "30_dias") => setFormData({ ...formData, termino_credito: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contado">Contado</SelectItem>
                <SelectItem value="8_dias">8 días</SelectItem>
                <SelectItem value="15_dias">15 días</SelectItem>
                <SelectItem value="30_dias">30 días</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="limite_credito">Límite de Crédito</Label>
            <Input
              id="limite_credito"
              type="number"
              step="0.01"
              value={formData.limite_credito}
              onChange={(e) => setFormData({ ...formData, limite_credito: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="preferencia_facturacion">Preferencia de Facturación</Label>
          <Select
            value={formData.preferencia_facturacion}
            onValueChange={(value: "siempre_factura" | "siempre_remision" | "variable") => setFormData({ ...formData, preferencia_facturacion: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="siempre_factura">Siempre factura</SelectItem>
              <SelectItem value="siempre_remision">Siempre remisión</SelectItem>
              <SelectItem value="variable">Variable (según pedido)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Define si este cliente normalmente requiere factura o remisión
          </p>
        </div>
      </div>

      {/* Sección de Correos Electrónicos */}
      <div className="space-y-4">
        <h4 className="font-medium text-lg border-b pb-2 flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Correos Electrónicos
        </h4>
        
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Email *</Label>
              <Input
                type="email"
                placeholder="correo@cliente.com"
                value={newCorreoEmail}
                onChange={(e) => setNewCorreoEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddCorreo())}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nombre contacto (opcional)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Juan Pérez"
                  value={newCorreoNombre}
                  onChange={(e) => setNewCorreoNombre(e.target.value)}
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="icon" onClick={handleAddCorreo}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {correos.length > 0 && (
            <div className="space-y-2">
              {correos.map((correo) => (
                <div 
                  key={correo.id} 
                  className="flex items-center gap-2 p-2 bg-muted/50 rounded-md"
                >
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{correo.email}</span>
                      {correo.es_principal && (
                        <Badge variant="default" className="text-xs shrink-0">Principal</Badge>
                      )}
                    </div>
                    {correo.nombre_contacto && (
                      <span className="text-xs text-muted-foreground">{correo.nombre_contacto}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!correo.es_principal && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => handleSetPrincipal(correo.id)}
                      >
                        Hacer principal
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 hover:bg-destructive/20"
                      onClick={() => handleRemoveCorreo(correo.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {correos.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              Agrega correos para enviar cotizaciones y facturas
            </p>
          )}
        </div>
      </div>

      {/* Sección de Sucursales de Entrega - Solo para nuevos clientes */}
      {!editingClient && (
        <div className="space-y-4">
          <h4 className="font-medium text-lg border-b pb-2 flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Sucursales de Entrega
          </h4>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="entregarMismaDireccion"
              checked={entregarMismaDireccion}
              onCheckedChange={(checked) => {
                setEntregarMismaDireccion(checked === true);
              }}
            />
            <Label htmlFor="entregarMismaDireccion" className="text-sm font-normal cursor-pointer">
              Entregar en la misma dirección fiscal (cliente simple como Pan Rol)
            </Label>
          </div>

          {!entregarMismaDireccion && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Agrega las sucursales de entrega para grupos como Universal o Lecaroz
              </p>

              {sucursales.length === 0 ? (
                <div className="text-center p-6 border-2 border-dashed rounded-lg">
                  <MapPin className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground mb-3">No hay sucursales agregadas</p>
                  <Button type="button" variant="outline" onClick={addSucursal}>
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Sucursal
                  </Button>
                </div>
              ) : (
                <>
                  {sucursales.map((sucursal, index) => (
                    <div 
                      key={sucursal.id} 
                      className="p-4 bg-muted/30 rounded-lg border space-y-4"
                    >
                      <div className="flex justify-between items-center">
                        <h5 className="font-medium">Sucursal {index + 1}</h5>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm"
                          onClick={() => removeSucursal(sucursal.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Nombre de Sucursal *</Label>
                          <Input
                            value={sucursal.nombre}
                            onChange={(e) => updateSucursal(sucursal.id, "nombre", e.target.value)}
                            placeholder="Ej: Dallas, Kansas, Centro"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Zona de Entrega</Label>
                          <Select
                            value={sucursal.zona_id}
                            onValueChange={(value) => updateSucursal(sucursal.id, "zona_id", value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona zona" />
                            </SelectTrigger>
                            <SelectContent>
                              {zonas.map((zona) => (
                                <SelectItem key={zona.id} value={zona.id}>
                                  {zona.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Dirección de Entrega *</Label>
                        <GoogleMapsAddressAutocomplete
                          value={sucursal.direccion}
                          onChange={(value) => updateSucursal(sucursal.id, "direccion", value)}
                          placeholder="Buscar dirección de entrega..."
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Contacto</Label>
                          <Input
                            value={sucursal.contacto}
                            onChange={(e) => updateSucursal(sucursal.id, "contacto", e.target.value)}
                            placeholder="Nombre del contacto"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Teléfono</Label>
                          <Input
                            value={sucursal.telefono}
                            onChange={(e) => updateSucursal(sucursal.id, "telefono", e.target.value)}
                            placeholder="Teléfono de la sucursal"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <Button type="button" variant="outline" onClick={addSucursal}>
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Otra Sucursal
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
          Cancelar
        </Button>
        <Button type="submit">
          {editingClient ? "Actualizar" : "Crear Cliente"}
        </Button>
      </div>
    </form>
  );
}
