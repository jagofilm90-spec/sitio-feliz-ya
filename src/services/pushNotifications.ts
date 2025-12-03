import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

// Verificar si estamos en plataforma nativa
export const isNativePlatform = () => Capacitor.isNativePlatform();

// Inicializar sistema de notificaciones push
export const initPushNotifications = async (): Promise<boolean> => {
  if (!isNativePlatform()) {
    console.log('Push notifications solo disponibles en plataforma nativa');
    return false;
  }

  try {
    // Solicitar permisos
    const permissionStatus = await PushNotifications.requestPermissions();
    
    if (permissionStatus.receive !== 'granted') {
      console.log('Permisos de notificaciones no otorgados');
      return false;
    }

    // Registrar para recibir notificaciones
    await PushNotifications.register();

    // Configurar listeners
    setupPushListeners();

    console.log('Sistema de notificaciones push inicializado');
    return true;
  } catch (error) {
    console.error('Error inicializando push notifications:', error);
    return false;
  }
};

// Configurar listeners para eventos de push
const setupPushListeners = () => {
  // Cuando se recibe el token de registro
  PushNotifications.addListener('registration', async (token: Token) => {
    console.log('Token de push recibido:', token.value);
    await saveDeviceToken(token.value);
  });

  // Error en registro
  PushNotifications.addListener('registrationError', (error) => {
    console.error('Error en registro de push:', error);
  });

  // Notificación recibida con app en primer plano
  PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
    console.log('Notificación recibida:', notification);
    // Aquí podrías mostrar un toast o actualizar la UI
    handleForegroundNotification(notification);
  });

  // Usuario tocó la notificación
  PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
    console.log('Acción de notificación:', action);
    handleNotificationTap(action);
  });
};

// Guardar token del dispositivo en la base de datos
const saveDeviceToken = async (token: string): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.log('No hay usuario autenticado para guardar token');
      return;
    }

    const platform = Capacitor.getPlatform();
    const deviceName = `${platform}-${Date.now()}`;

    const { error } = await supabase
      .from('device_tokens')
      .upsert({
        user_id: user.id,
        token: token,
        platform: platform,
        device_name: deviceName,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,token'
      });

    if (error) {
      console.error('Error guardando token:', error);
    } else {
      console.log('Token guardado exitosamente');
    }
  } catch (error) {
    console.error('Error en saveDeviceToken:', error);
  }
};

// Manejar notificación recibida en primer plano
const handleForegroundNotification = (notification: PushNotificationSchema) => {
  // Importar dinámicamente para evitar problemas de dependencias circulares
  import('@/hooks/use-toast').then(({ toast }) => {
    toast({
      title: notification.title || 'Nueva notificación',
      description: notification.body || '',
    });
  });
};

// Manejar tap en notificación
const handleNotificationTap = (action: ActionPerformed) => {
  const data = action.notification.data as Record<string, string> | undefined;
  
  if (!data?.type) return;

  // Navegar según el tipo de notificación
  switch (data.type) {
    case 'nuevo_pedido':
      window.location.href = '/pedidos?tab=por-autorizar';
      break;
    case 'pedido_autorizado':
      window.location.href = '/portal-cliente?tab=pedidos';
      break;
    case 'entrega_programada':
      window.location.href = '/portal-cliente?tab=entregas';
      break;
    case 'stock_bajo':
      window.location.href = '/inventario';
      break;
    case 'oc_pendiente':
      window.location.href = '/compras';
      break;
    case 'cotizacion_pendiente':
      window.location.href = '/pedidos?tab=cotizaciones';
      break;
    default:
      console.log('Tipo de notificación no manejado:', data.type);
  }
};

// Eliminar token del dispositivo (logout)
export const removeDeviceToken = async (): Promise<void> => {
  if (!isNativePlatform()) return;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const platform = Capacitor.getPlatform();

    await supabase
      .from('device_tokens')
      .delete()
      .eq('user_id', user.id)
      .eq('platform', platform);

    console.log('Token eliminado');
  } catch (error) {
    console.error('Error eliminando token:', error);
  }
};

// Verificar si las notificaciones están habilitadas
export const checkNotificationPermissions = async (): Promise<boolean> => {
  if (!isNativePlatform()) return false;

  try {
    const status = await PushNotifications.checkPermissions();
    return status.receive === 'granted';
  } catch {
    return false;
  }
};
