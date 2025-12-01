import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Mail, RefreshCw, Paperclip, Loader2, CheckCheck } from "lucide-react";
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
  isProcesado?: boolean;
}

interface EmailListViewProps {
  emails: Email[] | undefined;
  isLoading: boolean;
  onSelectEmail: (id: string, index: number) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  selectionMode: boolean;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}

const EmailListView = ({
  emails,
  isLoading,
  onSelectEmail,
  onRefresh,
  isRefreshing,
  selectedIds,
  onToggleSelect,
  selectionMode,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
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
      <Card>
        <div className="p-4 border-b bg-primary/5">
          <div className="flex items-center justify-center gap-3">
            <div className="relative">
              <Mail className="h-6 w-6 text-primary animate-pulse" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-ping" />
            </div>
            <span className="text-sm font-medium text-primary">
              Cargando correos...
            </span>
          </div>
        </div>
        <div className="divide-y">
          {/* Skeleton loader for emails */}
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-4 flex items-start gap-3 animate-pulse">
              <div className="w-2 h-2 mt-2 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="flex justify-between">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-3 bg-muted rounded w-16" />
                </div>
                <div className="h-4 bg-muted rounded w-2/3" />
                <div className="h-3 bg-muted rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      </Card>
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
          {emails.map((email, index) => (
            <div
              key={email.id}
              className="flex items-center gap-2 hover:bg-muted/50 transition-colors"
            >
              {selectionMode && (
                <div className="pl-4">
                  <Checkbox
                    checked={selectedIds.has(email.id)}
                    onCheckedChange={() => onToggleSelect(email.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )}
              <button
                className="w-full text-left p-4 flex items-start gap-3"
                onClick={() => onSelectEmail(email.id, index)}
              >
                {/* Blue dot for unread */}
                <div className="flex-shrink-0 w-2 h-2 mt-2">
                  {email.isUnread && (
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className={`truncate ${
                          email.isUnread ? "font-semibold" : ""
                        }`}
                      >
                        {extractSenderName(email.from)}
                      </span>
                      {email.isProcesado && (
                        <Badge variant="secondary" className="shrink-0 gap-1 text-xs">
                          <CheckCheck className="h-3 w-3" />
                          Procesado
                        </Badge>
                      )}
                    </div>
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
              </button>
            </div>
          ))}
          
          {/* Load More Button */}
          {hasMore && (
            <div className="p-4 flex justify-center">
              <Button
                variant="outline"
                onClick={onLoadMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Cargando...
                  </>
                ) : (
                  "Cargar más correos"
                )}
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
};

export default EmailListView;
