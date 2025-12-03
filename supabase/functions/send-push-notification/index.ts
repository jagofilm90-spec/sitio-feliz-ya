import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushNotificationRequest {
  user_ids?: string[];
  roles?: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const fcmServerKey = Deno.env.get('FCM_SERVER_KEY');

    if (!fcmServerKey) {
      console.log('FCM_SERVER_KEY no configurada - notificaciones push deshabilitadas');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'FCM_SERVER_KEY no configurada. Las notificaciones push requieren configuración de Firebase.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { user_ids, roles, title, body, data }: PushNotificationRequest = await req.json();

    console.log('Enviando notificación push:', { user_ids, roles, title });

    let targetUserIds: string[] = user_ids || [];

    // Si se especificaron roles, obtener usuarios con esos roles
    if (roles && roles.length > 0) {
      const { data: roleUsers, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', roles);

      if (roleError) {
        console.error('Error obteniendo usuarios por rol:', roleError);
      } else if (roleUsers) {
        const roleUserIds = roleUsers.map((r: { user_id: string }) => r.user_id);
        targetUserIds = [...new Set([...targetUserIds, ...roleUserIds])];
      }
    }

    if (targetUserIds.length === 0) {
      console.log('No hay usuarios destino para la notificación');
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No hay usuarios destino' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obtener tokens de dispositivo de los usuarios
    const { data: deviceTokens, error: tokenError } = await supabase
      .from('device_tokens')
      .select('token, platform, user_id')
      .in('user_id', targetUserIds);

    if (tokenError) {
      console.error('Error obteniendo tokens:', tokenError);
      throw new Error('Error obteniendo tokens de dispositivo');
    }

    if (!deviceTokens || deviceTokens.length === 0) {
      console.log('No hay tokens de dispositivo registrados');
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No hay dispositivos registrados' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Enviando a ${deviceTokens.length} dispositivos`);

    // Enviar notificación a cada dispositivo via FCM
    const sendPromises = deviceTokens.map(async (device: { token: string; platform: string; user_id: string }) => {
      try {
        const response = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Authorization': `key=${fcmServerKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            to: device.token,
            notification: {
              title,
              body,
              sound: 'default',
              badge: 1
            },
            data: {
              ...data,
              click_action: 'FLUTTER_NOTIFICATION_CLICK'
            },
            priority: 'high'
          })
        });

        const result = await response.json();
        
        // Si el token es inválido, eliminarlo
        if (result.failure === 1 && result.results?.[0]?.error === 'NotRegistered') {
          console.log('Token inválido, eliminando:', device.token.substring(0, 20) + '...');
          await supabase
            .from('device_tokens')
            .delete()
            .eq('token', device.token);
        }

        return { success: result.success === 1, device: device.platform };
      } catch (err) {
        console.error('Error enviando a dispositivo:', err);
        return { success: false, device: device.platform, error: String(err) };
      }
    });

    const results = await Promise.all(sendPromises);
    const successCount = results.filter(r => r.success).length;

    console.log(`Notificaciones enviadas: ${successCount}/${deviceTokens.length}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: successCount, 
        total: deviceTokens.length,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error en send-push-notification:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
