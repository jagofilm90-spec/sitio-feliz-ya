import { useState, useEffect } from 'react';
import { Bell, BellOff, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  initPushNotifications, 
  isNativePlatform, 
  checkNotificationPermissions 
} from '@/services/pushNotifications';

interface PushNotificationSetupProps {
  onComplete?: () => void;
}

export const PushNotificationSetup = ({ onComplete }: PushNotificationSetupProps) => {
  const [showDialog, setShowDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const checkPermissions = async () => {
      if (!isNativePlatform()) {
        setHasPermission(null);
        return;
      }

      const permitted = await checkNotificationPermissions();
      setHasPermission(permitted);

      // Si no tiene permisos, mostrar diálogo después de un breve delay
      if (!permitted) {
        const hasSeenPrompt = localStorage.getItem('push_notification_prompt_seen');
        if (!hasSeenPrompt) {
          setTimeout(() => setShowDialog(true), 2000);
        }
      }
    };

    checkPermissions();
  }, []);

  const handleEnableNotifications = async () => {
    setIsLoading(true);
    
    try {
      const success = await initPushNotifications();
      
      if (success) {
        setHasPermission(true);
        toast({
          title: 'Notificaciones activadas',
          description: 'Recibirás alertas de nuevos pedidos y actualizaciones importantes.',
        });
      } else {
        toast({
          title: 'No se pudieron activar',
          description: 'Por favor habilita las notificaciones en la configuración de tu dispositivo.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error activando notificaciones:', error);
      toast({
        title: 'Error',
        description: 'Ocurrió un error al activar las notificaciones.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setShowDialog(false);
      localStorage.setItem('push_notification_prompt_seen', 'true');
      onComplete?.();
    }
  };

  const handleSkip = () => {
    setShowDialog(false);
    localStorage.setItem('push_notification_prompt_seen', 'true');
    onComplete?.();
  };

  // No mostrar nada si no es plataforma nativa
  if (!isNativePlatform()) {
    return null;
  }

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Bell className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-center">Activar Notificaciones</DialogTitle>
          <DialogDescription className="text-center">
            Recibe alertas instantáneas cuando:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
              <Smartphone className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm font-medium">Nuevos pedidos</p>
              <p className="text-xs text-muted-foreground">
                Clientes envían pedidos desde el portal
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
              <Bell className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium">Autorizaciones pendientes</p>
              <p className="text-xs text-muted-foreground">
                Órdenes de compra y cotizaciones por aprobar
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900">
              <BellOff className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-medium">Alertas de inventario</p>
              <p className="text-xs text-muted-foreground">
                Stock bajo y productos por caducar
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button 
            onClick={handleEnableNotifications} 
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? 'Activando...' : 'Activar Notificaciones'}
          </Button>
          <Button 
            variant="ghost" 
            onClick={handleSkip}
            className="w-full"
          >
            Ahora no
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PushNotificationSetup;
