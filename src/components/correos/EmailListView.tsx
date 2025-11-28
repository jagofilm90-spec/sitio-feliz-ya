import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, RefreshCw, Paperclip, Loader2 } from "lucide-react";
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
