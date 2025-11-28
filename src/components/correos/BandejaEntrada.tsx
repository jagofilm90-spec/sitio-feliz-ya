import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Mail, 
  RefreshCw, 
  Inbox, 
  ChevronLeft, 
  Clock,
  User,
  Paperclip
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Email {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  isUnread: boolean;
  hasAttachments: boolean;
}

interface EmailDetail {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: string;
  attachments: { filename: string; mimeType: string }[];
}

interface BandejaEntradaProps {
  cuentaEmail: string;
  cuentaNombre: string;
}

const BandejaEntrada = ({ cuentaEmail, cuentaNombre }: BandejaEntradaProps) => {
  const { toast } = useToast();
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);

  // Fetch email list
  const { data: emails, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["gmail-inbox", cuentaEmail],
    queryFn: async () => {
      const response = await supabase.functions.invoke("gmail-api", {
        body: { 
          action: "list", 
          email: cuentaEmail,
          maxResults: 50
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data?.messages as Email[] || [];
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Fetch selected email detail
  const { data: emailDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ["gmail-email", cuentaEmail, selectedEmail],
    queryFn: async () => {
      if (!selectedEmail) return null;

      const response = await supabase.functions.invoke("gmail-api", {
        body: { 
          action: "read", 
          email: cuentaEmail,
          messageId: selectedEmail
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data as EmailDetail;
    },
    enabled: !!selectedEmail,
  });

  const formatEmailDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      
      if (isToday) {
        return format(date, "HH:mm", { locale: es });
      }
      return format(date, "d MMM", { locale: es });
    } catch {
      return dateStr;
    }
  };

  const extractSenderName = (from: string) => {
    const match = from.match(/^([^<]+)/);
    if (match) {
      return match[1].trim().replace(/"/g, "");
    }
    return from.split("@")[0];
  };

  if (selectedEmail && emailDetail) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setSelectedEmail(null)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Volver
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-xl">{emailDetail.subject || "(Sin asunto)"}</CardTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>{emailDetail.from}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>
                    {(() => {
                      try {
                        const date = new Date(emailDetail.date);
                        if (isNaN(date.getTime())) return emailDetail.date;
                        return format(date, "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es });
                      } catch {
                        return emailDetail.date;
                      }
                    })()}
                  </span>
                </div>
              </div>
            </div>
            {emailDetail.attachments?.length > 0 && (
              <div className="flex items-center gap-2 pt-2">
                <Paperclip className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {emailDetail.attachments.length} archivo(s) adjunto(s)
                </span>
              </div>
            )}
          </CardHeader>
          <Separator />
          <CardContent className="pt-4">
            <div 
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: emailDetail.body }}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Inbox className="h-5 w-5 text-primary" />
          <span className="font-medium">{cuentaNombre}</span>
          <Badge variant="outline" className="text-xs">
            {cuentaEmail}
          </Badge>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : emails && emails.length > 0 ? (
        <Card>
          <ScrollArea className="h-[600px]">
            <div className="divide-y">
              {emails.map((email) => (
                <button
                  key={email.id}
                  className={`w-full text-left p-4 hover:bg-muted/50 transition-colors ${
                    email.isUnread ? "bg-primary/5" : ""
                  }`}
                  onClick={() => setSelectedEmail(email.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`truncate ${email.isUnread ? "font-semibold" : ""}`}>
                          {extractSenderName(email.from)}
                        </span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatEmailDate(email.date)}
                        </span>
                      </div>
                      <div className={`text-sm truncate ${email.isUnread ? "font-medium" : ""}`}>
                        {email.subject || "(Sin asunto)"}
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {email.snippet}
                      </div>
                    </div>
                    {email.hasAttachments && (
                      <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mail className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay correos en la bandeja de entrada</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Verificar nuevamente
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoadingDetail && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
};

export default BandejaEntrada;
