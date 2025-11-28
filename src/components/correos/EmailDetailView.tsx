import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Paperclip,
  Reply,
  ReplyAll,
  Trash2,
  Loader2,
  Download,
  RotateCcw,
  FileText,
  Image,
  File,
  Forward,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ComposeEmailDialog from "./ComposeEmailDialog";

interface EmailAttachment {
  filename: string;
  mimeType: string;
  attachmentId: string;
  size: number;
}

interface EmailDetail {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: string;
  attachments: EmailAttachment[];
  isUnread?: boolean;
}

interface GmailCuenta {
  id: string;
  email: string;
  nombre: string;
  proposito: string;
}

interface EmailDetailViewProps {
  email: EmailDetail;
  cuentaEmail: string;
  cuentas?: GmailCuenta[];
  onBack: () => void;
  onDeleted: () => void;
  onNavigateNext?: () => void;
  onNavigatePrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
  isFromTrash?: boolean;
}

const EmailDetailView = ({
  email,
  cuentaEmail,
  cuentas,
  onBack,
  onDeleted,
  onNavigateNext,
  onNavigatePrev,
  hasNext = false,
  hasPrev = false,
  isFromTrash = false,
}: EmailDetailViewProps) => {
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyAllOpen, setReplyAllOpen] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [downloadingAttachment, setDownloadingAttachment] = useState<string | null>(null);

  // Keyboard navigation with arrow keys
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (replyOpen || replyAllOpen || forwardOpen) return; // Don't navigate when dialogs are open
    
    if (e.key === "ArrowRight" && hasNext && onNavigateNext) {
      e.preventDefault();
      onNavigateNext();
    } else if (e.key === "ArrowLeft" && hasPrev && onNavigatePrev) {
      e.preventDefault();
      onNavigatePrev();
    }
  }, [hasNext, hasPrev, onNavigateNext, onNavigatePrev, replyOpen, replyAllOpen, forwardOpen]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const extractEmailAddress = (from: string) => {
    const match = from.match(/<([^>]+)>/);
    return match ? match[1] : from;
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await supabase.functions.invoke("gmail-api", {
        body: {
          action: "delete",
          email: cuentaEmail,
          messageId: email.id,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: "Correo eliminado",
        description: "El correo ha sido movido a la papelera",
      });

      onDeleted();
    } catch (error: any) {
      console.error("Error deleting email:", error);
      toast({
        title: "Error al eliminar",
        description: error.message || "No se pudo eliminar el correo",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleRecover = async () => {
    setRecovering(true);
    try {
      const response = await supabase.functions.invoke("gmail-api", {
        body: {
          action: "untrash",
          email: cuentaEmail,
          messageId: email.id,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: "Correo recuperado",
        description: "El correo ha sido movido a la bandeja de entrada",
      });

      onDeleted();
    } catch (error: any) {
      console.error("Error recovering email:", error);
      toast({
        title: "Error al recuperar",
        description: error.message || "No se pudo recuperar el correo",
        variant: "destructive",
      });
    } finally {
      setRecovering(false);
    }
  };

  const handleDownloadAttachment = async (attachment: EmailAttachment) => {
    setDownloadingAttachment(attachment.attachmentId);
    try {
      const response = await supabase.functions.invoke("gmail-api", {
        body: {
          action: "downloadAttachment",
          email: cuentaEmail,
          messageId: email.id,
          attachmentId: attachment.attachmentId,
          filename: attachment.filename,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Convert base64 URL-safe to regular base64
      const base64Data = response.data.data
        .replace(/-/g, "+")
        .replace(/_/g, "/");

      // Create blob and download
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: attachment.mimeType });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Descarga completada",
        description: `${attachment.filename} descargado exitosamente`,
      });
    } catch (error: any) {
      console.error("Error downloading attachment:", error);
      toast({
        title: "Error al descargar",
        description: error.message || "No se pudo descargar el archivo",
        variant: "destructive",
      });
    } finally {
      setDownloadingAttachment(null);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return format(date, "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es });
    } catch {
      return dateStr;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return Image;
    if (mimeType === "application/pdf") return FileText;
    return File;
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Volver
            </Button>
            
            {/* Navigation arrows */}
            {(hasPrev || hasNext) && (
              <div className="flex items-center gap-1 ml-2">
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={onNavigatePrev}
                  disabled={!hasPrev}
                  title="Correo anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={onNavigateNext}
                  disabled={!hasNext}
                  title="Siguiente correo"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isFromTrash && (
              <>
                <Button variant="outline" size="sm" onClick={() => setReplyOpen(true)}>
                  <Reply className="h-4 w-4 mr-2" />
                  Responder
                </Button>
                <Button variant="outline" size="sm" onClick={() => setReplyAllOpen(true)}>
                  <ReplyAll className="h-4 w-4 mr-2" />
                  Responder a todos
                </Button>
                <Button variant="outline" size="sm" onClick={() => setForwardOpen(true)}>
                  <Forward className="h-4 w-4 mr-2" />
                  Reenviar
                </Button>
              </>
            )}

            {isFromTrash ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRecover}
                disabled={recovering}
              >
                {recovering ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4 mr-2" />
                )}
                Recuperar
              </Button>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={deleting}>
                    {deleting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Eliminar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar correo?</AlertDialogTitle>
                    <AlertDialogDescription>
                      El correo será movido a la papelera. Podrás recuperarlo desde ahí.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="space-y-2">
              <CardTitle className="text-xl">
                {email.subject || "(Sin asunto)"}
              </CardTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span className="font-medium text-foreground">De:</span>
                <span>{email.from}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span className="font-medium text-foreground">Para:</span>
                <span>{email.to}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{formatDate(email.date)}</span>
              </div>
            </div>

            {/* Attachments section with download */}
            {email.attachments?.length > 0 && (
              <div className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {email.attachments.length} archivo(s) adjunto(s)
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {email.attachments.map((att, i) => {
                    const FileIcon = getFileIcon(att.mimeType);
                    return (
                      <Button
                        key={i}
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadAttachment(att)}
                        disabled={downloadingAttachment === att.attachmentId}
                        className="h-auto py-2 px-3"
                      >
                        {downloadingAttachment === att.attachmentId ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <FileIcon className="h-4 w-4 mr-2" />
                        )}
                        <div className="flex flex-col items-start">
                          <span className="text-xs font-medium truncate max-w-[150px]">
                            {att.filename}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatFileSize(att.size)}
                          </span>
                        </div>
                        <Download className="h-3 w-3 ml-2" />
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}
          </CardHeader>
          <Separator />
          <CardContent className="pt-4">
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: email.body }}
            />
          </CardContent>
        </Card>
      </div>

      {/* Reply dialog */}
      <ComposeEmailDialog
        open={replyOpen}
        onOpenChange={setReplyOpen}
        fromEmail={cuentaEmail}
        cuentas={cuentas}
        replyTo={{
          to: extractEmailAddress(email.from),
          subject: email.subject,
          originalBody: email.body,
        }}
        onSuccess={onBack}
      />

      {/* Reply All dialog */}
      <ComposeEmailDialog
        open={replyAllOpen}
        onOpenChange={setReplyAllOpen}
        fromEmail={cuentaEmail}
        cuentas={cuentas}
        replyAll={{
          to: extractEmailAddress(email.from),
          cc: email.to || "",
          subject: email.subject,
          originalBody: email.body,
        }}
        onSuccess={onBack}
      />

      {/* Forward dialog */}
      <ComposeEmailDialog
        open={forwardOpen}
        onOpenChange={setForwardOpen}
        fromEmail={cuentaEmail}
        cuentas={cuentas}
        forwardData={{
          subject: email.subject,
          originalBody: email.body,
        }}
        onSuccess={onBack}
      />
    </>
  );
};

export default EmailDetailView;