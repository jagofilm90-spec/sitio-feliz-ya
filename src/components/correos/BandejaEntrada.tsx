import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Inbox, RefreshCw, PenSquare, Loader2 } from "lucide-react";
import EmailListView from "./EmailListView";
import EmailDetailView from "./EmailDetailView";
import ComposeEmailDialog from "./ComposeEmailDialog";

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

  const selectedCuenta = cuentas.find((c) => c.email === selectedAccount);

  // Fetch email list
  const {
    data: emails,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["gmail-inbox", selectedAccount],
    queryFn: async () => {
      if (!selectedAccount) return [];

      const response = await supabase.functions.invoke("gmail-api", {
        body: {
          action: "list",
          email: selectedAccount,
          maxResults: 50,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return (response.data?.messages as Email[]) || [];
    },
    enabled: !!selectedAccount,
    staleTime: 1000 * 60 * 2, // 2 minutes
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

  const handleAccountChange = (email: string) => {
    setSelectedAccount(email);
    setSelectedEmailId(null);
  };

  const handleEmailDeleted = () => {
    setSelectedEmailId(null);
    queryClient.invalidateQueries({
      queryKey: ["gmail-inbox", selectedAccount],
    });
  };

  const handleBack = () => {
    setSelectedEmailId(null);
  };

  // Show email detail view
  if (selectedEmailId && emailDetail) {
    return (
      <EmailDetailView
        email={emailDetail}
        cuentaEmail={selectedAccount}
        onBack={handleBack}
        onDeleted={handleEmailDeleted}
      />
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Header with account selector and actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Inbox className="h-5 w-5 text-primary" />
            <Select value={selectedAccount} onValueChange={handleAccountChange}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Selecciona una cuenta" />
              </SelectTrigger>
              <SelectContent>
                {cuentas.map((cuenta) => (
                  <SelectItem key={cuenta.id} value={cuenta.email}>
                    <div className="flex items-center gap-2">
                      <span>{cuenta.nombre}</span>
                      <Badge variant="outline" className="text-xs">
                        {cuenta.proposito}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
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

        {/* Email subtitle */}
        <div className="text-sm text-muted-foreground">
          Mostrando correos de:{" "}
          <span className="font-medium">{selectedAccount}</span>
        </div>

        {/* Email list */}
        <EmailListView
          emails={emails}
          isLoading={isLoading}
          onSelectEmail={setSelectedEmailId}
          onRefresh={() => refetch()}
          isRefreshing={isRefetching}
        />

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
