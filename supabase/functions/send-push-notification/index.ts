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

interface ServiceAccount {
  project_id: string;
  private_key: string;
  client_email: string;
}

// Base64URL encode
function base64UrlEncode(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Create JWT for Google OAuth2
async function createJWT(serviceAccount: ServiceAccount): Promise<string> {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  };

  const headerEncoded = base64UrlEncode(JSON.stringify(header));
  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${headerEncoded}.${payloadEncoded}`;

  // Import the private key
  const pemContents = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '');
  
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Sign the token
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureEncoded = base64UrlEncode(new Uint8Array(signature));
  return `${unsignedToken}.${signatureEncoded}`;
}

// Get OAuth2 access token
async function getAccessToken(serviceAccount: ServiceAccount): Promise<string> {
  const jwt = await createJWT(serviceAccount);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('OAuth2 token error:', error);
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const firebaseServiceAccountJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');

    if (!firebaseServiceAccountJson) {
      console.log('FIREBASE_SERVICE_ACCOUNT no configurada - notificaciones push deshabilitadas');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'FIREBASE_SERVICE_ACCOUNT no configurada. Las notificaciones push requieren configuración de Firebase.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    let serviceAccount: ServiceAccount;
    try {
      serviceAccount = JSON.parse(firebaseServiceAccountJson);
    } catch (parseError) {
      console.error('Error parsing FIREBASE_SERVICE_ACCOUNT:', parseError);
      return new Response(
        JSON.stringify({ success: false, message: 'Error parsing Firebase service account JSON' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { user_ids, roles, title, body, data }: PushNotificationRequest = await req.json();

    console.log('Enviando notificación push FCM V1:', { user_ids, roles, title });

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

    console.log(`Enviando a ${deviceTokens.length} dispositivos via FCM V1`);

    // Get OAuth2 access token
    const accessToken = await getAccessToken(serviceAccount);
    const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;

    // Enviar notificación a cada dispositivo via FCM V1
    const sendPromises = deviceTokens.map(async (device: { token: string; platform: string; user_id: string }) => {
      try {
        const message: any = {
          message: {
            token: device.token,
            notification: {
              title,
              body,
            },
            data: {
              ...data,
              click_action: 'FLUTTER_NOTIFICATION_CLICK'
            },
          }
        };

        // Add platform-specific configurations
        if (device.platform === 'android') {
          message.message.android = {
            priority: 'high',
            notification: {
              sound: 'default',
              default_sound: true,
              default_vibrate_timings: true,
            }
          };
        } else if (device.platform === 'ios') {
          message.message.apns = {
            payload: {
              aps: {
                sound: 'default',
                badge: 1,
              }
            }
          };
        }

        const response = await fetch(fcmEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(message)
        });

        const result = await response.json();
        
        if (!response.ok) {
          console.error('FCM V1 error for device:', result);
          
          // Si el token es inválido, eliminarlo
          if (result.error?.details?.some((d: any) => 
            d.errorCode === 'UNREGISTERED' || d.errorCode === 'INVALID_ARGUMENT'
          )) {
            console.log('Token inválido, eliminando:', device.token.substring(0, 20) + '...');
            await supabase
              .from('device_tokens')
              .delete()
              .eq('token', device.token);
          }
          
          return { success: false, device: device.platform, error: result.error?.message };
        }

        console.log('FCM V1 success:', result);
        return { success: true, device: device.platform, messageId: result.name };
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
