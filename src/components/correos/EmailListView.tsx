import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mail, RefreshCw, Paperclip } from "lucide-react";
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

interface EmailListViewProps {
  emails: Email[] | undefined;
  isLoading: boolean;
  onSelectEmail: (id: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

const EmailListView = ({
  emails,
  isLoading,
  onSelectEmail,
  onRefresh,
  isRefreshing,
}: EmailListViewProps) => {
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
          <Mail className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            No hay correos en la bandeja de entrada
          </p>
          <Button variant="outline" className="mt-4" onClick={onRefresh}>
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
            <button
              key={email.id}
              className={`w-full text-left p-4 hover:bg-muted/50 transition-colors ${
                email.isUnread ? "bg-primary/5" : ""
              }`}
              onClick={() => onSelectEmail(email.id)}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`truncate ${
                        email.isUnread ? "font-semibold" : ""
                      }`}
                    >
                      {extractSenderName(email.from)}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatEmailDate(email.date)}
                    </span>
                  </div>
                  <div
                    className={`text-sm truncate ${
                      email.isUnread ? "font-medium" : ""
                    }`}
                  >
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
  );
};

export default EmailListView;
