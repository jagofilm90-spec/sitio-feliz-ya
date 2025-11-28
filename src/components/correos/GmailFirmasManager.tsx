import { useState } from "react";
import DOMPurify from "dompurify";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, Mail } from "lucide-react";

interface GmailCuenta {
  id: string;
  email: string;
  nombre: string;
}

interface GmailFirmasManagerProps {
  cuentas: GmailCuenta[];
}

const GmailFirmasManager = ({ cuentas }: GmailFirmasManagerProps) => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: firmas, isLoading } = useQuery({
    queryKey: ["gmail-firmas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gmail_firmas")
        .select("*");
      
      if (error) throw error;
      return data || [];
    },
  });

  const getFirmaForCuenta = (cuentaId: string) => {
    return firmas?.find(f => f.gmail_cuenta_id === cuentaId);
  };

  const handleEdit = (cuentaId: string) => {
    const firma = getFirmaForCuenta(cuentaId);
    setEditingId(cuentaId);
    setEditValue(firma?.firma_html || "");
  };

  const handleSave = async (cuentaId: string) => {
    setSaving(true);
    try {
      const existingFirma = getFirmaForCuenta(cuentaId);
      
      if (existingFirma) {
        const { error } = await supabase
          .from("gmail_firmas")
          .update({ firma_html: editValue, updated_at: new Date().toISOString() })
          .eq("id", existingFirma.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("gmail_firmas")
          .insert({ gmail_cuenta_id: cuentaId, firma_html: editValue });
        
        if (error) throw error;
      }

      toast.success("Firma guardada exitosamente");
      queryClient.invalidateQueries({ queryKey: ["gmail-firmas"] });
      setEditingId(null);
      setEditValue("");
    } catch (error: any) {
      toast.error("Error al guardar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValue("");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Firmas de Correo</h3>
        <p className="text-sm text-muted-foreground">
          Configura la firma que se añadirá automáticamente a los correos enviados desde cada cuenta
        </p>
      </div>

      <div className="grid gap-4">
        {cuentas.map((cuenta) => {
          const firma = getFirmaForCuenta(cuenta.id);
          const isEditing = editingId === cuenta.id;

          return (
            <Card key={cuenta.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10">
                      <Mail className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{cuenta.nombre}</CardTitle>
                      <CardDescription>{cuenta.email}</CardDescription>
                    </div>
                  </div>
                  <Badge variant={firma?.firma_html ? "default" : "secondary"}>
                    {firma?.firma_html ? "Configurada" : "Sin firma"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Firma (HTML permitido)</Label>
                      <Textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder="<p>Saludos cordiales,</p><p><strong>Nombre</strong><br>Empresa</p>"
                        className="min-h-[150px] font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Puedes usar HTML básico: &lt;p&gt;, &lt;strong&gt;, &lt;em&gt;, &lt;br&gt;
                      </p>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={handleCancel} disabled={saving}>
                        Cancelar
                      </Button>
                      <Button onClick={() => handleSave(cuenta.id)} disabled={saving}>
                        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        Guardar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {firma?.firma_html ? (
                      <div 
                        className="p-3 bg-muted rounded-md text-sm prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(firma.firma_html) }}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        No hay firma configurada para esta cuenta
                      </p>
                    )}
                    <Button variant="outline" size="sm" onClick={() => handleEdit(cuenta.id)}>
                      {firma?.firma_html ? "Editar firma" : "Agregar firma"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default GmailFirmasManager;
