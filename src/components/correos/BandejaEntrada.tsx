import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { Inbox, RefreshCw, PenSquare, Loader2, ChevronDown, Search, Trash2, Mail } from "lucide-react";
import EmailListView from "./EmailListView";
import EmailDetailView from "./EmailDetailView";
import ComposeEmailDialog from "./ComposeEmailDialog";
import TrashListView from "./TrashListView";

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
  attachments: { filename: string; mimeType: string; attachmentId: string; size: number }[];
  isUnread: boolean;
}

interface GmailCuenta {
  id: string;
  email: string;
  nombre: string;
  proposito: string;
  activo: boolean;
  access_token: string | null;
  refresh_token: string | null;
}

interface BandejaEntradaProps {
  cuentas: GmailCuenta[];
}

const BandejaEntrada = ({ cuentas }: BandejaEntradaProps) => {
  const queryClient = useQueryClient();
  const [selectedAccount, setSelectedAccount] = useState<string>(
    cuentas[0]?.email || ""
  );
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [activeTab, setActiveTab] = useState("inbox");
  const [isFromTrash, setIsFromTrash] = useState(false);

  const selectedCuenta = cuentas.find((c) => c.email === selectedAccount);

  // Fetch unread counts for all accounts
  const { data: unreadCounts } = useQuery({
    queryKey: ["gmail-unread-counts"],
    queryFn: async () => {
      const counts: Record<string, number> = {};
      for (const cuenta of cuentas) {
        try {
          const response = await supabase.functions.invoke("gmail-api", {
            body: { action: "getUnreadCount", email: cuenta.email },
          });
          if (response.data?.unreadCount !== undefined) {
            counts[cuenta.email] = response.data.unreadCount;
          }
        } catch (e) {
          console.error("Error fetching unread count for", cuenta.email, e);
        }
      }
      return counts;
    },
    staleTime: 1000 * 60, // 1 minute
    refetchInterval: 1000 * 60 * 2, // Refetch every 2 minutes
  });

  // Fetch email list
  const {
    data: emails,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["gmail-inbox", selectedAccount, activeSearch],
    queryFn: async () => {
      if (!selectedAccount) return [];

      const response = await supabase.functions.invoke("gmail-api", {
        body: {
          action: "list",
          email: selectedAccount,
          maxResults: 50,
          searchQuery: activeSearch || undefined,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return (response.data?.messages as Email[]) || [];
    },
    enabled: !!selectedAccount && activeTab === "inbox",
    staleTime: 1000 * 60 * 2,
  });

  // Fetch selected email detail
  const { data: emailDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ["gmail-email", selectedAccount, selectedEmailId],
    queryFn: async () => {
      if (!selectedEmailId || !selectedAccount) return null;

      const response = await supabase.functions.invoke("gmail-api", {
        body: {
          action: "read",
          email: selectedAccount,
          messageId: selectedEmailId,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data as EmailDetail;
    },
    enabled: !!selectedEmailId && !!selectedAccount,
  });

  // Mark email as read when viewing
  useEffect(() => {
    if (emailDetail?.isUnread && selectedEmailId && !isFromTrash) {
      supabase.functions.invoke("gmail-api", {
        body: {
          action: "markAsRead",
          email: selectedAccount,
          messageId: selectedEmailId,
        },
      }).then(() => {
        // Invalidate queries to refresh unread counts
        queryClient.invalidateQueries({ queryKey: ["gmail-unread-counts"] });
        queryClient.invalidateQueries({ queryKey: ["gmail-inbox", selectedAccount] });
      });
    }
  }, [emailDetail?.isUnread, selectedEmailId, selectedAccount, isFromTrash, queryClient]);

  const handleAccountChange = (email: string) => {
    setSelectedAccount(email);
    setSelectedEmailId(null);
    setSearchQuery("");
    setActiveSearch("");
  };

  const handleEmailDeleted = () => {
    setSelectedEmailId(null);
    setIsFromTrash(false);
    queryClient.invalidateQueries({
      queryKey: ["gmail-inbox", selectedAccount],
    });
    queryClient.invalidateQueries({
      queryKey: ["gmail-trash", selectedAccount],
    });
    queryClient.invalidateQueries({ queryKey: ["gmail-unread-counts"] });
  };

  const handleBack = () => {
    setSelectedEmailId(null);
    setIsFromTrash(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchQuery);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setActiveSearch("");
  };

  const handleSelectEmail = (id: string, fromTrash: boolean = false) => {
    setSelectedEmailId(id);
    setIsFromTrash(fromTrash);
  };

  // Show email detail view
  if (selectedEmailId && emailDetail) {
    return (
      <EmailDetailView
        email={emailDetail}
        cuentaEmail={selectedAccount}
        onBack={handleBack}
        onDeleted={handleEmailDeleted}
        isFromTrash={isFromTrash}
      />
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Header with account dropdown and actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-primary" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-[300px] justify-between">
                  <div className="flex items-center gap-2">
                    <span>{selectedCuenta?.nombre || "Seleccionar cuenta"}</span>
                    {unreadCounts?.[selectedAccount] ? (
                      <Badge variant="destructive" className="text-xs">
                        {unreadCounts[selectedAccount]}
                      </Badge>
                    ) : null}
                  </div>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[300px] bg-popover" align="start">
                {cuentas.map((cuenta) => (
                  <DropdownMenuItem
                    key={cuenta.id}
                    onClick={() => handleAccountChange(cuenta.email)}
                    className="flex items-center justify-between"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{cuenta.nombre}</span>
                      <span className="text-xs text-muted-foreground">{cuenta.email}</span>
                    </div>
                    {unreadCounts?.[cuenta.email] ? (
                      <Badge variant="destructive" className="text-xs">
                        {unreadCounts[cuenta.email]}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        {cuenta.proposito}
                      </Badge>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetch();
                queryClient.invalidateQueries({ queryKey: ["gmail-unread-counts"] });
              }}
              disabled={isRefetching}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`}
              />
              Actualizar
            </Button>

            <Button size="sm" onClick={() => setComposeOpen(true)}>
              <PenSquare className="h-4 w-4 mr-2" />
              Redactar
            </Button>
          </div>
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar correos por remitente, asunto o contenido..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button type="submit" variant="secondary">
            Buscar
          </Button>
          {activeSearch && (
            <Button type="button" variant="ghost" onClick={clearSearch}>
              Limpiar
            </Button>
          )}
        </form>

        {activeSearch && (
          <div className="text-sm text-muted-foreground">
            Resultados para: <span className="font-medium">"{activeSearch}"</span>
          </div>
        )}

        {/* Tabs for Inbox and Trash */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="inbox" className="gap-2">
              <Inbox className="h-4 w-4" />
              Bandeja de entrada
              {unreadCounts?.[selectedAccount] ? (
                <Badge variant="destructive" className="text-xs ml-1">
                  {unreadCounts[selectedAccount]}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="trash" className="gap-2">
              <Trash2 className="h-4 w-4" />
              Papelera
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inbox" className="mt-4">
            <EmailListView
              emails={emails}
              isLoading={isLoading}
              onSelectEmail={(id) => handleSelectEmail(id, false)}
              onRefresh={() => refetch()}
              isRefreshing={isRefetching}
            />
          </TabsContent>

          <TabsContent value="trash" className="mt-4">
            <TrashListView
              email={selectedAccount}
              onSelectEmail={(id) => handleSelectEmail(id, true)}
              onEmailRecovered={handleEmailDeleted}
            />
          </TabsContent>
        </Tabs>

        {/* Loading overlay for email detail */}
        {isLoadingDetail && (
          <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
      </div>

      {/* Compose email dialog */}
      <ComposeEmailDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        fromEmail={selectedAccount}
        onSuccess={() => refetch()}
      />
    </>
  );
};

export default BandejaEntrada;
