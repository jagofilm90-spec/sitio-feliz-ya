import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Send, X, Loader2, Paperclip, FileText, Image, File, Trash2, ChevronDown, ChevronUp, Cloud } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logEmailAction } from "@/hooks/useGmailPermisos";

interface AttachmentFile {
  filename: string;
  mimeType: string;
  content: string;
  size: number;
  isDriveLink?: boolean;
  driveLink?: string;
}

interface GmailCuenta {
  id: string;
  email: string;
  nombre: string;
  proposito: string;
}

interface ComposeEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromEmail: string;
  cuentas?: GmailCuenta[];
  replyTo?: {
    to: string;
    cc?: string;
    subject: string;
    originalBody?: string;
  };
  replyAll?: {
    to: string;
    cc: string;
    subject: string;
    originalBody?: string;
  };
  forwardData?: {
    subject: string;
    originalBody: string;
    attachments?: AttachmentFile[];
  };
  onSuccess?: () => void;
}

const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;
const MAX_SINGLE_FILE_FOR_EMAIL = 24 * 1024 * 1024; // Files larger than this go to Drive

const ComposeEmailDialog = ({
  open,
  onOpenChange,
  fromEmail,
  cuentas,
  replyTo,
  replyAll,
  forwardData,
  onSuccess,
}: ComposeEmailDialogProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  const [selectedFromEmail, setSelectedFromEmail] = useState(fromEmail);
  const [to, setTo] = useState(replyTo?.to || replyAll?.to || "");
  const [cc, setCc] = useState(replyTo?.cc || replyAll?.cc || "");
  const [bcc, setBcc] = useState("");
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [uploadingToDrive, setUploadingToDrive] = useState(false);

  // Fetch signature for selected account
  const { data: firmaData } = useQuery({
    queryKey: ["gmail-firma", selectedFromEmail],
    queryFn: async () => {
      const cuenta = cuentas?.find(c => c.email === selectedFromEmail);
      if (!cuenta) return null;
      
      const { data, error } = await supabase
        .from("gmail_firmas")
        .select("firma_html")
        .eq("gmail_cuenta_id", cuenta.id)
        .eq("activo", true)
        .maybeSingle();
      
      if (error) return null;
      return data?.firma_html || null;
    },
    enabled: !!selectedFromEmail && !!cuentas,
  });

  useEffect(() => {
    setSelectedFromEmail(fromEmail);
  }, [fromEmail]);

  useEffect(() => {
    if (open) {
      setSelectedFromEmail(fromEmail);
      setTo(replyTo?.to || replyAll?.to || "");
      setCc(replyTo?.cc || replyAll?.cc || "");
      setBcc("");
      setShowCcBcc(!!(replyTo?.cc || replyAll?.cc));
      
      const subjectBase = replyTo?.subject || replyAll?.subject || forwardData?.subject || "";
      if (replyTo || replyAll) {
        setSubject(`Re: ${subjectBase.replace(/^Re:\s*/i, "").replace(/^Fwd:\s*/i, "")}`);
      } else if (forwardData) {
        setSubject(`Fwd: ${subjectBase.replace(/^Fwd:\s*/i, "")}`);
      } else {
        setSubject("");
      }
      
      setBody("");
      setAttachments(forwardData?.attachments || []);
    }
  }, [open, fromEmail, replyTo, replyAll, forwardData]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: AttachmentFile[] = [];
    let totalSize = attachments.reduce((sum, att) => sum + att.size, 0);

    for (const file of Array.from(files)) {
      // Check if file is too large for email attachment
      if (file.size > MAX_SINGLE_FILE_FOR_EMAIL) {
        // Upload to Google Drive
        toast({
          title: "Subiendo a Drive",
          description: `${file.name} es muy grande (${formatFileSize(file.size)}). Subiendo a Google Drive...`,
        });
        
        setUploadingToDrive(true);
        try {
          const base64 = await fileToBase64(file);
          const response = await supabase.functions.invoke("gmail-api", {
            body: {
              action: "uploadToDrive",
              email: selectedFromEmail,
              fileContent: base64,
              fileName: file.name,
              mimeType: file.type || "application/octet-stream",
            },
          });

          if (response.error) throw new Error(response.error.message);
          
          newAttachments.push({
            filename: file.name,
            mimeType: file.type || "application/octet-stream",
            content: "",
            size: file.size,
            isDriveLink: true,
            driveLink: response.data.shareLink,
          });
          
          toast({
            title: "Archivo subido a Drive",
            description: `${file.name} se compartirá como enlace`,
          });
        } catch (error: any) {
          toast({
            title: "Error al subir a Drive",
            description: error.message || "No se pudo subir el archivo",
            variant: "destructive",
          });
        } finally {
          setUploadingToDrive(false);
        }
        continue;
      }

      if (totalSize + file.size > MAX_ATTACHMENT_SIZE) {
        toast({
          title: "Límite de tamaño excedido",
          description: "El tamaño total no puede exceder 25MB",
          variant: "destructive",
        });
        break;
      }

      try {
        const base64 = await fileToBase64(file);
        newAttachments.push({
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          content: base64,
          size: file.size,
        });
        totalSize += file.size;
      } catch (error) {
        toast({
          title: "Error al leer archivo",
          description: `No se pudo leer ${file.name}`,
          variant: "destructive",
        });
      }
    }

    setAttachments([...attachments, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return Image;
    if (mimeType === "application/pdf") return FileText;
    return File;
  };

  const handleSend = async () => {
    if (!to.trim()) {
      toast({ title: "Error", description: "El destinatario es requerido", variant: "destructive" });
      return;
    }
    if (!subject.trim()) {
      toast({ title: "Error", description: "El asunto es requerido", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      let emailBody = body.replace(/\n/g, "<br>");
      
      // Add Drive links for large files
      const driveAttachments = attachments.filter(a => a.isDriveLink);
      if (driveAttachments.length > 0) {
        emailBody += "<br><br><strong>📎 Archivos compartidos vía Google Drive:</strong><ul>";
        for (const att of driveAttachments) {
          emailBody += `<li><a href="${att.driveLink}">${att.filename}</a> (${formatFileSize(att.size)})</li>`;
        }
        emailBody += "</ul>";
      }
      
      if (firmaData) {
        emailBody += `<br><br>${firmaData}`;
      }
      
      const originalBody = replyTo?.originalBody || replyAll?.originalBody;
      if (originalBody) {
        emailBody += `<br><br>---<br><em>En respuesta a:</em><br>${originalBody}`;
      }
      
      if (forwardData?.originalBody) {
        emailBody += `<br><br>---<br><em>Mensaje reenviado:</em><br>${forwardData.originalBody}`;
      }

      // Only send non-Drive attachments as actual email attachments
      const emailAttachments = attachments.filter(a => !a.isDriveLink);

      const response = await supabase.functions.invoke("gmail-api", {
        body: {
          action: "send",
          email: selectedFromEmail,
          to: to.trim(),
          cc: cc.trim() || undefined,
          bcc: bcc.trim() || undefined,
          subject: subject.trim(),
          body: emailBody,
          attachments: emailAttachments.length > 0 ? emailAttachments : undefined,
        },
      });

      if (response.error) throw new Error(response.error.message);

      const selectedCuenta = cuentas?.find(c => c.email === selectedFromEmail);
      if (selectedCuenta) {
        const accion = replyTo || replyAll ? "responder" : forwardData ? "reenviar" : "enviar";
        logEmailAction(selectedCuenta.id, accion, {
          emailTo: to.trim(),
          emailSubject: subject.trim(),
          gmailMessageId: response.data?.messageId,
        });
      }

      toast({ title: "Correo enviado", description: `Correo enviado exitosamente a ${to}` });

      setTo("");
      setCc("");
      setBcc("");
      setSubject("");
      setBody("");
      setAttachments([]);
      setShowCcBcc(false);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({ title: "Error al enviar", description: error.message || "No se pudo enviar", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    if (!sending) onOpenChange(false);
  };

  const dialogTitle = replyAll ? "Responder a todos" : replyTo ? "Responder correo" : forwardData ? "Reenviar correo" : "Nuevo correo";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="from">Desde</Label>
            {cuentas && cuentas.length > 1 ? (
              <Select value={selectedFromEmail} onValueChange={setSelectedFromEmail} disabled={sending}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {cuentas.map((cuenta) => (
                    <SelectItem key={cuenta.id} value={cuenta.email}>
                      {cuenta.nombre} ({cuenta.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={selectedFromEmail} disabled className="bg-muted" />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="to">Para</Label>
            <Input
              id="to"
              type="email"
              placeholder="destinatario@ejemplo.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              disabled={sending}
            />
          </div>

          <Collapsible open={showCcBcc} onOpenChange={setShowCcBcc}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
                {showCcBcc ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                CC / CCO
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="cc">CC (Copia)</Label>
                <Input
                  id="cc"
                  type="email"
                  placeholder="cc@ejemplo.com, otro@ejemplo.com"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  disabled={sending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bcc">CCO (Copia oculta)</Label>
                <Input
                  id="bcc"
                  type="email"
                  placeholder="cco@ejemplo.com"
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  disabled={sending}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="space-y-2">
            <Label htmlFor="subject">Asunto</Label>
            <Input
              id="subject"
              placeholder="Asunto del correo"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={sending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Mensaje</Label>
            <Textarea
              id="body"
              placeholder="Escribe tu mensaje aquí..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={sending}
              className="min-h-[200px]"
            />
            {firmaData && (
              <p className="text-xs text-muted-foreground">Se añadirá la firma automáticamente</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Archivos adjuntos</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending || uploadingToDrive}
              >
                {uploadingToDrive ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Paperclip className="h-4 w-4 mr-2" />
                )}
                {uploadingToDrive ? "Subiendo a Drive..." : "Adjuntar archivo"}
              </Button>
              <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" />
            </div>

            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-md">
                {attachments.map((att, i) => {
                  const FileIcon = att.isDriveLink ? Cloud : getFileIcon(att.mimeType);
                  return (
                    <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-md border ${att.isDriveLink ? 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800' : 'bg-background'}`}>
                      <FileIcon className={`h-4 w-4 ${att.isDriveLink ? 'text-blue-600' : 'text-muted-foreground'}`} />
                      <div className="flex flex-col">
                        <span className="text-xs font-medium truncate max-w-[150px]">{att.filename}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatFileSize(att.size)}
                          {att.isDriveLink && <span className="ml-1 text-blue-600">(Drive)</span>}
                        </span>
                      </div>
                      <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeAttachment(i)} disabled={sending}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Cualquier tipo de archivo. Archivos &gt;24MB se suben automáticamente a Google Drive como enlace.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handleClose} disabled={sending}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleSend} disabled={sending || uploadingToDrive}>
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Enviar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ComposeEmailDialog;
