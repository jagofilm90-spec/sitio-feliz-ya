import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, RefreshCw, RotateCcw, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface TrashEmail {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
}

interface TrashListViewProps {
  email: string;
  onSelectEmail: (id: string) => void;
  onEmailRecovered: () => void;
}

const TrashListView = ({ email, onSelectEmail, onEmailRecovered }: TrashListViewProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [recoveringId, setRecoveringId] = useState<string | null>(null);

  const { data: emails, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["gmail-trash", email],
    queryFn: async () => {
      if (!email) return [];

      const response = await supabase.functions.invoke("gmail-api", {
        body: {
          action: "listTrash",
          email: email,
          maxResults: 50,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return (response.data?.messages as TrashEmail[]) || [];
    },
    enabled: !!email,
    staleTime: 1000 * 60 * 2,
  });

  const handleRecover = async (e: React.MouseEvent, messageId: string) => {
    e.stopPropagation();
    setRecoveringId(messageId);

    try {
      const response = await supabase.functions.invoke("gmail-api", {
        body: {
          action: "untrash",
          email: email,
          messageId: messageId,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: "Correo recuperado",
        description: "El correo ha sido movido a la bandeja de entrada",
      });

      queryClient.invalidateQueries({ queryKey: ["gmail-trash", email] });
      queryClient.invalidateQueries({ queryKey: ["gmail-inbox", email] });
      onEmailRecovered();
    } catch (error: any) {
      console.error("Error recovering email:", error);
      toast({
        title: "Error al recuperar",
        description: error.message || "No se pudo recuperar el correo",
        variant: "destructive",
      });
    } finally {
      setRecoveringId(null);
    }
  };

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!emails || emails.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Trash2 className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">La papelera está vacía</p>
          <Button variant="outline" className="mt-4" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Verificar nuevamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <ScrollArea className="h-[600px]">
        <div className="divide-y">
          {emails.map((email) => (
            <div
              key={email.id}
              className="w-full text-left p-4 hover:bg-muted/50 transition-colors flex items-start gap-3"
            >
              <button
                className="flex-1 min-w-0 text-left"
                onClick={() => onSelectEmail(email.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-muted-foreground">
                    {extractSenderName(email.from)}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatEmailDate(email.date)}
                  </span>
                </div>
                <div className="text-sm truncate text-muted-foreground">
                  {email.subject || "(Sin asunto)"}
                </div>
                <div className="text-sm text-muted-foreground/70 truncate">
                  {email.snippet}
                </div>
              </button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => handleRecover(e, email.id)}
                disabled={recoveringId === email.id}
                className="flex-shrink-0"
              >
                {recoveringId === email.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                <span className="ml-1 hidden sm:inline">Recuperar</span>
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
};

export default TrashListView;
