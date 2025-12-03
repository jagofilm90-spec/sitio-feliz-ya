import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ClienteProductosTab } from "./ClienteProductosTab";

interface ClienteProductosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: { id: string; nombre: string } | null;
}

export function ClienteProductosDialog({
  open,
  onOpenChange,
  cliente,
}: ClienteProductosDialogProps) {
  if (!cliente) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Productos de {cliente.nombre}</DialogTitle>
        </DialogHeader>
        <ClienteProductosTab clienteId={cliente.id} />
      </DialogContent>
    </Dialog>
  );
}
