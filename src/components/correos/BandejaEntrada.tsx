import { useState, useEffect, useRef } from "react";
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
import { Inbox, RefreshCw, PenSquare, Loader2, ChevronDown, Search, Trash2, Mail, Bell, CheckCheck, CheckSquare, Square, Filter } from "lucide-react";
import { toast } from "sonner";
import EmailListView from "./EmailListView";
import EmailDetailView from "./EmailDetailView";
import ComposeEmailDialog from "./ComposeEmailDialog";
import TrashListView from "./TrashListView";
import { playNotificationSound } from "@/utils/notificationSound";

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
  const [selectedEmailIndex, setSelectedEmailIndex] = useState<number>(-1);
  const [composeOpen, setComposeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [activeTab, setActiveTab] = useState("inbox");
  const [isFromTrash, setIsFromTrash] = useState(false);
  const [markingAllAsRead, setMarkingAllAsRead] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedEmailIds, setSelectedEmailIds] = useState<Set<string>>(new Set());
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [showOnlyUnread, setShowOnlyUnread] = useState(false);
  const [markingAllInboxAsRead, setMarkingAllInboxAsRead] = useState(false);
  // Flag to open first unread email after account switch from notification
  const [pendingOpenUnread, setPendingOpenUnread] = useState<string | null>(null);
  
  // Track previous unread counts to detect new emails
  const previousUnreadCountsRef = useRef<Record<string, number>>({});
  const isInitialLoadRef = useRef(true);
  // Flag to suppress notifications during user-initiated actions
  const suppressNotificationsRef = useRef(false);

  const selectedCuenta = cuentas.find((c) => c.email === selectedAccount);

  // Fetch unread counts for all accounts IN PARALLEL - much faster initial load
  const { data: unreadCounts } = useQuery({
    queryKey: ["gmail-unread-counts"],
    queryFn: async () => {
      // Fetch all counts in parallel instead of sequentially
      const results = await Promise.allSettled(
        cuentas.map(cuenta =>
          supabase.functions.invoke("gmail-api", {
            body: { action: "getUnreadCount", email: cuenta.email },
          }).then(response => ({
            email: cuenta.email,
            count: response.data?.unreadCount ?? 0,
          }))
        )
      );
      
      const counts: Record<string, number> = {};
      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          counts[result.value.email] = result.value.count;
        } else {
          counts[cuentas[index].email] = 0;
        }
      });
      return counts;
    },
    staleTime: 1000 * 15, // 15 seconds
    refetchInterval: 1000 * 30, // Every 30 seconds - TIEMPO REAL
  });

  // Detect new emails and show notifications
  useEffect(() => {
    if (!unreadCounts) return;
    
    // Skip notification on initial load
    if (isInitialLoadRef.current) {
      previousUnreadCountsRef.current = { ...unreadCounts };
      isInitialLoadRef.current = false;
      return;
    }

    // Skip notifications if we're suppressing them (during user-initiated actions like marking as read)
    if (suppressNotificationsRef.current) {
      previousUnreadCountsRef.current = { ...unreadCounts };
      return;
    }

    // Check each account for new emails
    for (const cuenta of cuentas) {
      const currentCount = unreadCounts[cuenta.email] || 0;
      const previousCount = previousUnreadCountsRef.current[cuenta.email] || 0;
      
      // If unread count increased, we have new emails
      if (currentCount > previousCount) {
        const newEmailsCount = currentCount - previousCount;
        
        // Play notification sound
        playNotificationSound();
        
        // Show toast notification
        toast.info(
          `${newEmailsCount} nuevo${newEmailsCount > 1 ? 's' : ''} correo${newEmailsCount > 1 ? 's' : ''} en ${cuenta.nombre}`,
          {
            description: cuenta.email,
            icon: <Bell className="h-4 w-4" />,
            action: {
              label: "Ver",
              onClick: () => {
                setSelectedAccount(cuenta.email);
                setActiveTab("inbox");
                // Set flag to open first unread email after emails load
                setPendingOpenUnread(cuenta.email);
              },
            },
            duration: 8000,
          }
        );

        // Request browser notification permission and show notification
        if (typeof Notification !== 'undefined') {
          if (Notification.permission === "granted") {
            new Notification(`Nuevo correo en ${cuenta.nombre}`, {
              body: `${newEmailsCount} correo${newEmailsCount > 1 ? 's' : ''} sin leer`,
              icon: "/favicon.ico",
            });
          } else if (Notification.permission !== "denied") {
            Notification.requestPermission();
          }
        }
      }
    }
    
  // Update previous counts
    previousUnreadCountsRef.current = { ...unreadCounts };
  }, [unreadCounts, cuentas]);

  // State for pagination
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [allEmails, setAllEmails] = useState<Email[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Fetch email list - every 60 seconds
  const {
    data: emailsData,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["gmail-inbox", selectedAccount, activeSearch],
    queryFn: async () => {
      if (!selectedAccount) return { messages: [], nextPageToken: null };

      const response = await supabase.functions.invoke("gmail-api", {
        body: {
          action: "list",
          email: selectedAccount,
          maxResults: 25, // Reduced for faster initial load
          searchQuery: activeSearch || undefined,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return {
        messages: (response.data?.messages as Email[]) || [],
        nextPageToken: response.data?.nextPageToken || null,
      };
    },
    enabled: !!selectedAccount && activeTab === "inbox",
    staleTime: 1000 * 15, // 15 seconds - data considered fresh
    gcTime: 1000 * 60 * 10, // Keep in cache for 10 minutes
    refetchInterval: 1000 * 30, // Refetch every 30 seconds - TIEMPO REAL
    refetchOnWindowFocus: true, // Refresh when user returns
  });

  // Update allEmails and nextPageToken when initial data loads
  useEffect(() => {
    if (emailsData) {
      setAllEmails(emailsData.messages);
      setNextPageToken(emailsData.nextPageToken);
    }
  }, [emailsData]);

  // Reset pagination when account or search changes
  useEffect(() => {
    setAllEmails([]);
    setNextPageToken(null);
  }, [selectedAccount, activeSearch]);

  // Load more emails
  const handleLoadMore = async () => {
    if (!nextPageToken || isLoadingMore) return;
    
    setIsLoadingMore(true);
    try {
      const response = await supabase.functions.invoke("gmail-api", {
        body: {
          action: "list",
          email: selectedAccount,
          maxResults: 50,
          searchQuery: activeSearch || undefined,
          pageToken: nextPageToken,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const newMessages = (response.data?.messages as Email[]) || [];
      setAllEmails(prev => [...prev, ...newMessages]);
      setNextPageToken(response.data?.nextPageToken || null);
    } catch (error) {
      console.error("Error loading more emails:", error);
      toast.error("Error al cargar más correos");
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Use allEmails instead of emails for display
  const emails = allEmails;

  // Auto-open first unread email when triggered from notification
  useEffect(() => {
    if (pendingOpenUnread && emails && emails.length > 0 && selectedAccount === pendingOpenUnread && !isLoading) {
      // Find the first unread email
      const firstUnread = emails.find(e => e.isUnread);
      if (firstUnread) {
        const index = emails.indexOf(firstUnread);
        setSelectedEmailId(firstUnread.id);
        setSelectedEmailIndex(index);
        setIsFromTrash(false);
      } else {
        // If no unread, open the first email
        setSelectedEmailId(emails[0].id);
        setSelectedEmailIndex(0);
        setIsFromTrash(false);
      }
      setPendingOpenUnread(null);
    }
  }, [pendingOpenUnread, emails, selectedAccount, isLoading]);

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

  // Mark email as read when viewing - with optimistic update
  useEffect(() => {
    if (emailDetail?.isUnread && selectedEmailId && !isFromTrash) {
      // Suppress notifications during this action
      suppressNotificationsRef.current = true;
      
      // Optimistic update: immediately update local state
      setAllEmails(prev => 
        prev.map(e => e.id === selectedEmailId ? { ...e, isUnread: false } : e)
      );
      
      // Optimistic update: decrement unread count and sync the ref
      queryClient.setQueryData(
        ["gmail-unread-counts"],
        (oldData: Record<string, number> | undefined) => {
          if (!oldData) return oldData;
          const newCounts = {
            ...oldData,
            [selectedAccount]: Math.max(0, (oldData[selectedAccount] || 0) - 1),
          };
          previousUnreadCountsRef.current = { ...newCounts };
          return newCounts;
        }
      );

      // Call API to mark as read
      supabase.functions.invoke("gmail-api", {
        body: {
          action: "markAsRead",
          email: selectedAccount,
          messageId: selectedEmailId,
        },
      }).then(() => {
        // Refresh to ensure sync with server
        queryClient.invalidateQueries({ queryKey: ["gmail-unread-counts"] });
        // Re-enable notifications after a short delay
        setTimeout(() => {
          suppressNotificationsRef.current = false;
        }, 2000);
      });
    }
  }, [emailDetail?.isUnread, selectedEmailId, selectedAccount, isFromTrash, queryClient, activeSearch]);

  const handleAccountChange = (email: string) => {
    setSelectedAccount(email);
    setSelectedEmailId(null);
    setSelectedEmailIndex(-1);
    setSearchQuery("");
    setActiveSearch("");
    setSelectedEmailIds(new Set());
    setSelectionMode(false);
  };

  // Toggle selection of an email
  const handleToggleSelect = (id: string) => {
    setSelectedEmailIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Select all emails
  const handleSelectAll = () => {
    if (emails) {
      setSelectedEmailIds(new Set(emails.map(e => e.id)));
    }
  };

  // Clear selection
  const handleClearSelection = () => {
    setSelectedEmailIds(new Set());
    setSelectionMode(false);
  };

  // Delete selected emails - optimistic, non-blocking
  const handleDeleteSelected = () => {
    if (selectedEmailIds.size === 0) return;

    const selectedIdsArray = Array.from(selectedEmailIds);
    const unreadSelectedCount = emails?.filter(e => selectedIdsArray.includes(e.id) && e.isUnread).length || 0;
    const count = selectedEmailIds.size;

    suppressNotificationsRef.current = true;
    
    // Optimistic update: remove emails from local state immediately
    setAllEmails(prev => prev.filter(e => !selectedIdsArray.includes(e.id)));
    
    // Optimistic update: decrement unread count
    queryClient.setQueryData(
      ["gmail-unread-counts"],
      (oldData: Record<string, number> | undefined) => {
        if (!oldData) return oldData;
        const newCounts = {
          ...oldData,
          [selectedAccount]: Math.max(0, (oldData[selectedAccount] || 0) - unreadSelectedCount),
        };
        previousUnreadCountsRef.current = { ...newCounts };
        return newCounts;
      }
    );

    // Clear selection immediately - UI responds fast
    toast.success(`${count} correo(s) eliminado(s)`);
    setSelectedEmailIds(new Set());
    setSelectionMode(false);

    // Fire batch API call in background (non-blocking)
    supabase.functions.invoke("gmail-api", {
      body: {
        action: "trash",
        email: selectedAccount,
        messageId: selectedIdsArray,
      },
    }).then(() => {
      // Sync silently
      queryClient.invalidateQueries({ queryKey: ["gmail-unread-counts"] });
      queryClient.invalidateQueries({ queryKey: ["gmail-trash", selectedAccount] });
    }).catch((error) => {
      console.error("Error deleting:", error);
      // On error, refresh to get actual state
      queryClient.invalidateQueries({ queryKey: ["gmail-inbox", selectedAccount] });
      queryClient.invalidateQueries({ queryKey: ["gmail-unread-counts"] });
    }).finally(() => {
      setTimeout(() => {
        suppressNotificationsRef.current = false;
      }, 2000);
    });
  };

  // Mark selected emails as read - optimistic, non-blocking
  const handleMarkSelectedAsRead = () => {
    if (selectedEmailIds.size === 0) return;

    const selectedIdsArray = Array.from(selectedEmailIds);
    const unreadSelectedCount = emails?.filter(e => selectedIdsArray.includes(e.id) && e.isUnread).length || 0;
    const count = selectedEmailIds.size;

    // Suppress notifications during this action
    suppressNotificationsRef.current = true;
    
    // Optimistic update: immediately update local state
    setAllEmails(prev => 
      prev.map(e => selectedIdsArray.includes(e.id) ? { ...e, isUnread: false } : e)
    );
    
    // Optimistic update: decrement unread count
    queryClient.setQueryData(
      ["gmail-unread-counts"],
      (oldData: Record<string, number> | undefined) => {
        if (!oldData) return oldData;
        const newCounts = {
          ...oldData,
          [selectedAccount]: Math.max(0, (oldData[selectedAccount] || 0) - unreadSelectedCount),
        };
        previousUnreadCountsRef.current = { ...newCounts };
        return newCounts;
      }
    );

    // Clear selection immediately - UI responds fast
    toast.success(`${count} correo(s) marcado(s) como leído(s)`);
    setSelectedEmailIds(new Set());
    setSelectionMode(false);

    // Fire API call in background (non-blocking)
    supabase.functions.invoke("gmail-api", {
      body: {
        action: "markAsRead",
        email: selectedAccount,
        messageId: selectedIdsArray,
      },
    }).then(() => {
      // Sync with server silently
      queryClient.invalidateQueries({ queryKey: ["gmail-unread-counts"] });
    }).catch((error) => {
      console.error("Error marking as read:", error);
      // On error, refresh to get actual state
      queryClient.invalidateQueries({ queryKey: ["gmail-inbox", selectedAccount] });
      queryClient.invalidateQueries({ queryKey: ["gmail-unread-counts"] });
    }).finally(() => {
      setTimeout(() => {
        suppressNotificationsRef.current = false;
      }, 2000);
    });
  };

  const handleEmailDeleted = () => {
    setSelectedEmailId(null);
    setSelectedEmailIndex(-1);
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
    setSelectedEmailIndex(-1);
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

  const handleSelectEmail = (id: string, fromTrash: boolean = false, index: number = -1) => {
    setSelectedEmailId(id);
    setSelectedEmailIndex(index);
    setIsFromTrash(fromTrash);
  };

  // Navigate to next email
  const handleNavigateNext = () => {
    if (emails && selectedEmailIndex < emails.length - 1) {
      const nextIndex = selectedEmailIndex + 1;
      setSelectedEmailIndex(nextIndex);
      setSelectedEmailId(emails[nextIndex].id);
    }
  };

  // Navigate to previous email
  const handleNavigatePrev = () => {
    if (emails && selectedEmailIndex > 0) {
      const prevIndex = selectedEmailIndex - 1;
      setSelectedEmailIndex(prevIndex);
      setSelectedEmailId(emails[prevIndex].id);
    }
  };

   // Mark all emails as read
  const handleMarkAllAsRead = async () => {
    if (!emails || emails.length === 0) return;
    
    const unreadEmails = emails.filter(e => e.isUnread);
    if (unreadEmails.length === 0) {
      toast.info("No hay correos sin leer");
      return;
    }

    setMarkingAllAsRead(true);
    suppressNotificationsRef.current = true;
    
    try {
      // Mark all unread emails as read
      await Promise.all(
        unreadEmails.map(email =>
          supabase.functions.invoke("gmail-api", {
            body: {
              action: "markAsRead",
              email: selectedAccount,
              messageId: email.id,
            },
          })
        )
      );

      toast.success(`${unreadEmails.length} correo(s) marcado(s) como leído(s)`);
      
      // Refresh data
      await queryClient.invalidateQueries({ queryKey: ["gmail-unread-counts"] });
      await queryClient.invalidateQueries({ queryKey: ["gmail-inbox", selectedAccount] });
    } catch (error) {
      console.error("Error marking all as read:", error);
      toast.error("Error al marcar correos como leídos");
    } finally {
      setMarkingAllAsRead(false);
      setTimeout(() => {
        suppressNotificationsRef.current = false;
      }, 2000);
    }
  };

  // Mark ALL emails in ALL accounts as read (resets everything to 0)
  const handleMarkAllAccountsAsRead = async () => {
    const totalUnread = Object.values(unreadCounts || {}).reduce((sum, count) => sum + count, 0);
    
    if (totalUnread === 0) {
      toast.info("No hay correos sin leer en ninguna cuenta");
      return;
    }

    const confirmed = window.confirm(
      `¿Estás seguro de marcar TODOS los ${totalUnread.toLocaleString()} correos sin leer como leídos en TODAS las cuentas?\n\nEsto puede tardar unos minutos.`
    );
    
    if (!confirmed) return;

    setMarkingAllInboxAsRead(true);
    suppressNotificationsRef.current = true;
    
    toast.info("Marcando todos los correos como leídos... Esto puede tardar unos minutos.");

    try {
      // Mark all emails as read for ALL accounts in parallel
      const results = await Promise.allSettled(
        cuentas.map(cuenta =>
          supabase.functions.invoke("gmail-api", {
            body: {
              action: "markAllInboxAsRead",
              email: cuenta.email,
            },
          })
        )
      );

      let totalMarked = 0;
      results.forEach((result, index) => {
        if (result.status === "fulfilled" && result.value.data?.totalMarked) {
          totalMarked += result.value.data.totalMarked;
          console.log(`${cuentas[index].email}: ${result.value.data.totalMarked} emails marked`);
        }
      });

      // Reset all counts to 0 optimistically
      queryClient.setQueryData(["gmail-unread-counts"], () => {
        const zeroCounts: Record<string, number> = {};
        cuentas.forEach(c => { zeroCounts[c.email] = 0; });
        previousUnreadCountsRef.current = { ...zeroCounts };
        return zeroCounts;
      });

      // Clear local emails state
      setAllEmails(prev => prev.map(e => ({ ...e, isUnread: false })));

      toast.success(`¡Listo! ${totalMarked.toLocaleString()} correos marcados como leídos`);
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["gmail-unread-counts"] });
      queryClient.invalidateQueries({ queryKey: ["gmail-inbox"] });
    } catch (error) {
      console.error("Error marking all accounts as read:", error);
      toast.error("Error al marcar correos como leídos");
    } finally {
      setMarkingAllInboxAsRead(false);
      setTimeout(() => {
        suppressNotificationsRef.current = false;
      }, 2000);
    }
  };

  // Show email detail view
  if (selectedEmailId && emailDetail) {
    return (
      <EmailDetailView
        email={emailDetail}
        cuentaEmail={selectedAccount}
        cuentas={cuentas}
        onBack={handleBack}
        onDeleted={handleEmailDeleted}
        onNavigateNext={handleNavigateNext}
        onNavigatePrev={handleNavigatePrev}
        hasNext={emails ? selectedEmailIndex < emails.length - 1 : false}
        hasPrev={selectedEmailIndex > 0}
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
              onClick={handleMarkAllAsRead}
              disabled={markingAllAsRead || isLoading}
              title="Marcar todos como leídos"
            >
              {markingAllAsRead ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCheck className="h-4 w-4 mr-2" />
              )}
              Marcar leídos
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleMarkAllAccountsAsRead}
              disabled={markingAllInboxAsRead}
              title="Marcar TODOS los correos de TODAS las cuentas como leídos"
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {markingAllInboxAsRead ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCheck className="h-4 w-4 mr-2" />
              )}
              Resetear TODO a 0
            </Button>

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
              Nuevo correo
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
          <div className="flex flex-wrap items-center justify-between gap-2">
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

            {/* Filter and Selection controls */}
            {activeTab === "inbox" && (
              <div className="flex items-center gap-2">
                <Button
                  variant={showOnlyUnread ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowOnlyUnread(!showOnlyUnread)}
                  title="Mostrar solo no leídos"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  No leídos
                </Button>
                {!selectionMode ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectionMode(true)}
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Seleccionar
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAll}
                    >
                      <CheckSquare className="h-4 w-4 mr-2" />
                      Seleccionar todos
                    </Button>
                    {selectedEmailIds.size > 0 && (
                      <>
                        <Badge variant="secondary">
                          {selectedEmailIds.size} seleccionado(s)
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleMarkSelectedAsRead}
                          disabled={markingAllAsRead}
                        >
                          {markingAllAsRead ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <CheckCheck className="h-4 w-4 mr-2" />
                          )}
                          Marcar leídos
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleDeleteSelected}
                          disabled={deletingSelected}
                        >
                          {deletingSelected ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 mr-2" />
                          )}
                          Eliminar
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearSelection}
                    >
                      Cancelar
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          <TabsContent value="inbox" className="mt-4">
            <EmailListView
              emails={showOnlyUnread ? emails.filter(e => e.isUnread) : emails}
              isLoading={isLoading}
              onSelectEmail={(id, index) => handleSelectEmail(id, false, index)}
              onRefresh={() => refetch()}
              isRefreshing={isRefetching}
              selectedIds={selectedEmailIds}
              onToggleSelect={handleToggleSelect}
              selectionMode={selectionMode}
              hasMore={!!nextPageToken}
              isLoadingMore={isLoadingMore}
              onLoadMore={handleLoadMore}
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

      {/* Compose email dialog with account selector */}
      <ComposeEmailDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        fromEmail={selectedAccount}
        cuentas={cuentas}
        onSuccess={() => refetch()}
      />
    </>
  );
};

export default BandejaEntrada;