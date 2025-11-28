import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const email = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      console.error("OAuth error:", error);
      return new Response(
        `<html><body><h1>Error de autenticación</h1><p>${error}</p><script>setTimeout(() => window.close(), 3000)</script></body></html>`,
        { headers: { "Content-Type": "text/html" } }
      );
    }

    if (!code || !email) {
      throw new Error("Código o email faltante");
    }

    const GMAIL_CLIENT_ID = Deno.env.get("GMAIL_CLIENT_ID");
    const GMAIL_CLIENT_SECRET = Deno.env.get("GMAIL_CLIENT_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Configuración de secretos incompleta");
    }

    // Exchange code for tokens
    const redirectUri = `${SUPABASE_URL}/functions/v1/gmail-callback`;
    
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GMAIL_CLIENT_ID,
        client_secret: GMAIL_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange failed:", errorText);
      throw new Error("Error al obtener tokens de Gmail");
    }

    const tokens = await tokenResponse.json();
    console.log("Tokens received for:", email);

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000));

    // Store tokens in database using service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Update existing record (account must already exist in gmail_cuentas)
    const { error: updateError, data } = await supabase
      .from("gmail_cuentas")
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        token_expires_at: expiresAt.toISOString(),
      })
      .eq("email", email)
      .select();

    if (updateError) {
      console.error("Error saving tokens:", updateError);
      throw new Error("Error al guardar credenciales");
    }

    if (!data || data.length === 0) {
      console.error("No account found for email:", email);
      throw new Error("Cuenta de correo no encontrada. Asegúrate de que esté registrada primero.");
    }

    console.log("Tokens saved successfully for:", email);

    // Return success page that closes itself
    return new Response(
      `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Gmail Conectado</title>
        <style>
          body { font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f0f9ff; }
          .container { text-align: center; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          h1 { color: #059669; margin-bottom: 16px; }
          p { color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>✓ Gmail Conectado</h1>
          <p>La cuenta ${email} ha sido conectada exitosamente.</p>
          <p>Esta ventana se cerrará automáticamente...</p>
        </div>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'gmail-connected', email: '${email}' }, '*');
          }
          setTimeout(() => window.close(), 2000);
        </script>
      </body>
      </html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (error: unknown) {
    console.error("Error in gmail-callback:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return new Response(
      `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Error</title>
        <style>
        body { font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #fef2f2; }
        .container { text-align: center; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        h1 { color: #dc2626; }
      </style>
      </head>
      <body>
        <div class="container">
          <h1>Error</h1>
          <p>${message}</p>
        </div>
      </body>
      </html>`,
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  }
});
