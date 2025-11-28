import { useState, useRef } from "react";
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
import { Send, X, Loader2, Paperclip, FileText, Image, File, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AttachmentFile {
  filename: string;
  mimeType: string;
  content: string; // base64
  size: number;
}

interface ComposeEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromEmail: string;
  replyTo?: {
    to: string;
    subject: string;
    originalBody?: string;
  };
  onSuccess?: () => void;
}

const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25MB total
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
];

const ComposeEmailDialog = ({
  open,
  onOpenChange,
  fromEmail,
  replyTo,
  onSuccess,
}: ComposeEmailDialogProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  const [to, setTo] = useState(replyTo?.to || "");
  const [subject, setSubject] = useState(
    replyTo?.subject ? `Re: ${replyTo.subject.replace(/^Re:\s*/i, "")}` : ""
  );
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: AttachmentFile[] = [];
    let totalSize = attachments.reduce((sum, att) => sum + att.size, 0);

    for (const file of Array.from(files)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast({
          title: "Tipo de archivo no permitido",
          description: `${file.name} no es un tipo de archivo permitido`,
          variant: "destructive",
        });
        continue;
      }

      if (totalSize + file.size > MAX_ATTACHMENT_SIZE) {
        toast({
          title: "Límite de tamaño excedido",
          description: "El tamaño total de los archivos adjuntos no puede exceder 25MB",
          variant: "destructive",
        });
        break;
      }

      try {
        const base64 = await fileToBase64(file);
        newAttachments.push({
          filename: file.name,
          mimeType: file.type,
          content: base64,
          size: file.size,
        });
        totalSize += file.size;
      } catch (error) {
        console.error("Error reading file:", error);
        toast({
          title: "Error al leer archivo",
          description: `No se pudo leer ${file.name}`,
          variant: "destructive",
        });
      }
    }

    setAttachments([...attachments, ...newAttachments]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix
        const base64 = result.split(",")[1];
        resolve(base64);
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
      toast({
        title: "Error",
        description: "El destinatario es requerido",
        variant: "destructive",
      });
      return;
    }

    if (!subject.trim()) {
      toast({
        title: "Error",
        description: "El asunto es requerido",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      let emailBody = body.replace(/\n/g, "<br>");
      
      // If replying, add original message
      if (replyTo?.originalBody) {
        emailBody += `<br><br>---<br><em>En respuesta a:</em><br>${replyTo.originalBody}`;
      }

      const response = await supabase.functions.invoke("gmail-api", {
        body: {
          action: "send",
          email: fromEmail,
          to: to.trim(),
          subject: subject.trim(),
          body: emailBody,
          attachments: attachments.length > 0 ? attachments : undefined,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: "Correo enviado",
        description: `Correo enviado exitosamente a ${to}`,
      });

      // Reset form
      setTo("");
      setSubject("");
      setBody("");
      setAttachments([]);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast({
        title: "Error al enviar",
        description: error.message || "No se pudo enviar el correo",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    if (!sending) {
      setTo(replyTo?.to || "");
      setSubject(replyTo?.subject ? `Re: ${replyTo.subject.replace(/^Re:\s*/i, "")}` : "");
      setBody("");
      setAttachments([]);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{replyTo ? "Responder correo" : "Nuevo correo"}</span>
            <span className="text-sm font-normal text-muted-foreground">
              Desde: {fromEmail}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
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
          </div>

          {/* Attachments section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Archivos adjuntos</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending}
              >
                <Paperclip className="h-4 w-4 mr-2" />
                Adjuntar archivo
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-md">
                {attachments.map((att, i) => {
                  const FileIcon = getFileIcon(att.mimeType);
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2 bg-background px-3 py-2 rounded-md border"
                    >
                      <FileIcon className="h-4 w-4 text-muted-foreground" />
                      <div className="flex flex-col">
                        <span className="text-xs font-medium truncate max-w-[150px]">
                          {att.filename}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatFileSize(att.size)}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => removeAttachment(i)}
                        disabled={sending}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Formatos permitidos: PDF, JPG, PNG, GIF, DOC, DOCX, XLS, XLSX, TXT, CSV (máx. 25MB total)
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={sending}
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleSend} disabled={sending}>
              {sending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Enviar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ComposeEmailDialog;
