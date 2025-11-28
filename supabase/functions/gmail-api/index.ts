import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const GMAIL_CLIENT_ID = Deno.env.get("GMAIL_CLIENT_ID");
  const GMAIL_CLIENT_SECRET = Deno.env.get("GMAIL_CLIENT_SECRET");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GMAIL_CLIENT_ID!,
      client_secret: GMAIL_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    console.error("Failed to refresh token:", await response.text());
    return null;
  }

  return response.json();
}

async function getValidAccessToken(supabase: any, cuenta: any): Promise<string | null> {
  const now = new Date();
  const tokenExpiry = new Date(cuenta.token_expires_at);

  // If token is still valid (with 5 min buffer), return it
  if (tokenExpiry > new Date(now.getTime() + 5 * 60 * 1000)) {
    return cuenta.access_token;
  }

  // Token expired, refresh it
  if (!cuenta.refresh_token) {
    console.error("No refresh token available for:", cuenta.email);
    return null;
  }

  const newTokens = await refreshAccessToken(cuenta.refresh_token);
  if (!newTokens) {
    return null;
  }

  // Update tokens in database
  const newExpiry = new Date(Date.now() + newTokens.expires_in * 1000);
  await supabase
    .from("gmail_cuentas")
    .update({
      access_token: newTokens.access_token,
      token_expires_at: newExpiry.toISOString(),
    })
    .eq("id", cuenta.id);

  return newTokens.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const { action, email, to, subject, body: emailBody, maxResults, messageId } = await req.json();

    // Get account credentials
    const { data: cuenta, error: cuentaError } = await supabase
      .from("gmail_cuentas")
      .select("*")
      .eq("email", email)
      .eq("activo", true)
      .single();

    if (cuentaError || !cuenta) {
      throw new Error(`Cuenta ${email} no encontrada o no activa`);
    }

    const accessToken = await getValidAccessToken(supabase, cuenta);
    if (!accessToken) {
      throw new Error(`No se pudo obtener token válido para ${email}. Reconecte la cuenta.`);
    }

    if (action === "list") {
      // List recent emails
      const listResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults || 20}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!listResponse.ok) {
        throw new Error("Error al listar correos");
      }

      const listData = await listResponse.json();
      const messages = [];

      // Get details for each message
      for (const msg of (listData.messages || []).slice(0, maxResults || 20)) {
        const msgResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (msgResponse.ok) {
          const msgData = await msgResponse.json();
          const headers = msgData.payload?.headers || [];
          messages.push({
            id: msg.id,
            threadId: msg.threadId,
            from: headers.find((h: any) => h.name === "From")?.value || "",
            subject: headers.find((h: any) => h.name === "Subject")?.value || "",
            date: headers.find((h: any) => h.name === "Date")?.value || "",
            snippet: msgData.snippet || "",
          });
        }
      }

      return new Response(
        JSON.stringify({ messages }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "send") {
      if (!to || !subject) {
        throw new Error("Destinatario y asunto requeridos");
      }

      // Construct email
      const emailLines = [
        `From: ${email}`,
        `To: ${to}`,
        `Subject: ${subject}`,
        "Content-Type: text/html; charset=utf-8",
        "",
        emailBody || "",
      ];

      const rawEmail = btoa(emailLines.join("\r\n"))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const sendResponse = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ raw: rawEmail }),
        }
      );

      if (!sendResponse.ok) {
        const errorText = await sendResponse.text();
        console.error("Send failed:", errorText);
        throw new Error("Error al enviar correo");
      }

      const sendData = await sendResponse.json();
      console.log("Email sent successfully:", sendData.id);

      return new Response(
        JSON.stringify({ success: true, messageId: sendData.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "read") {
      if (!messageId) {
        throw new Error("messageId requerido");
      }

      const msgResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!msgResponse.ok) {
        throw new Error("Error al leer correo");
      }

      const msgData = await msgResponse.json();
      const headers = msgData.payload?.headers || [];
      
      // Extract body from message parts
      let bodyHtml = "";
      let bodyText = "";
      
      const extractBody = (part: any) => {
        if (part.mimeType === "text/html" && part.body?.data) {
          bodyHtml = atob(part.body.data.replace(/-/g, "+").replace(/_/g, "/"));
        } else if (part.mimeType === "text/plain" && part.body?.data) {
          bodyText = atob(part.body.data.replace(/-/g, "+").replace(/_/g, "/"));
        }
        if (part.parts) {
          part.parts.forEach(extractBody);
        }
      };
      
      if (msgData.payload?.body?.data) {
        const mimeType = msgData.payload.mimeType;
        const decoded = atob(msgData.payload.body.data.replace(/-/g, "+").replace(/_/g, "/"));
        if (mimeType === "text/html") {
          bodyHtml = decoded;
        } else {
          bodyText = decoded;
        }
      }
      
      if (msgData.payload?.parts) {
        msgData.payload.parts.forEach(extractBody);
      }
      
      // Extract attachments
      const attachments: { filename: string; mimeType: string }[] = [];
      const extractAttachments = (part: any) => {
        if (part.filename && part.body?.attachmentId) {
          attachments.push({ filename: part.filename, mimeType: part.mimeType });
        }
        if (part.parts) {
          part.parts.forEach(extractAttachments);
        }
      };
      if (msgData.payload?.parts) {
        msgData.payload.parts.forEach(extractAttachments);
      }

      const emailDetail = {
        id: msgData.id,
        from: headers.find((h: any) => h.name === "From")?.value || "",
        to: headers.find((h: any) => h.name === "To")?.value || "",
        subject: headers.find((h: any) => h.name === "Subject")?.value || "",
        date: headers.find((h: any) => h.name === "Date")?.value || "",
        body: bodyHtml || bodyText.replace(/\n/g, "<br>") || msgData.snippet || "",
        attachments,
      };

      return new Response(
        JSON.stringify(emailDetail),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Acción no reconocida: ${action}`);
  } catch (error: unknown) {
    console.error("Error in gmail-api:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
