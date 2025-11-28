import { useState } from "react";
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
  Clock,
  User,
  Paperclip,
  Reply,
  Trash2,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ComposeEmailDialog from "./ComposeEmailDialog";

interface EmailDetail {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: string;
  attachments: { filename: string; mimeType: string }[];
}

interface EmailDetailViewProps {
  email: EmailDetail;
  cuentaEmail: string;
  onBack: () => void;
  onDeleted: () => void;
}

const EmailDetailView = ({
  email,
  cuentaEmail,
  onBack,
  onDeleted,
}: EmailDetailViewProps) => {
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);

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

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return format(date, "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es });
    } catch {
      return dateStr;
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Volver
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setReplyOpen(true)}>
              <Reply className="h-4 w-4 mr-2" />
              Responder
            </Button>

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
                    El correo será movido a la papelera. Podrás recuperarlo desde Gmail.
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
            {email.attachments?.length > 0 && (
              <div className="flex items-center gap-2 pt-2">
                <Paperclip className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {email.attachments.length} archivo(s) adjunto(s):
                </span>
                <div className="flex flex-wrap gap-1">
                  {email.attachments.map((att, i) => (
                    <span
                      key={i}
                      className="text-xs bg-muted px-2 py-1 rounded"
                    >
                      {att.filename}
                    </span>
                  ))}
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

      <ComposeEmailDialog
        open={replyOpen}
        onOpenChange={setReplyOpen}
        fromEmail={cuentaEmail}
        replyTo={{
          to: extractEmailAddress(email.from),
          subject: email.subject,
          originalBody: email.body,
        }}
        onSuccess={onBack}
      />
    </>
  );
};

export default EmailDetailView;
