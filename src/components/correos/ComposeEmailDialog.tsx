import { useState } from "react";
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
import { Send, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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

const ComposeEmailDialog = ({
  open,
  onOpenChange,
  fromEmail,
  replyTo,
  onSuccess,
}: ComposeEmailDialogProps) => {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [to, setTo] = useState(replyTo?.to || "");
  const [subject, setSubject] = useState(
    replyTo?.subject ? `Re: ${replyTo.subject.replace(/^Re:\s*/i, "")}` : ""
  );
  const [body, setBody] = useState("");

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
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
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
