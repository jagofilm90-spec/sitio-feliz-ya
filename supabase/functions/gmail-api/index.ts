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

  if (tokenExpiry > new Date(now.getTime() + 5 * 60 * 1000)) {
    return cuenta.access_token;
  }

  if (!cuenta.refresh_token) {
    console.error("No refresh token available for:", cuenta.email);
    return null;
  }

  const newTokens = await refreshAccessToken(cuenta.refresh_token);
  if (!newTokens) {
    return null;
  }

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

// Helper function to decode base64 URL-safe to UTF-8 string
const decodeBase64Utf8 = (base64Data: string): string => {
  const binary = atob(base64Data.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder("utf-8").decode(bytes);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const { action, email, to, subject, body: emailBody, maxResults, messageId, searchQuery, attachmentId, filename, attachments: emailAttachments, pageToken } = await req.json();

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

    // LIST - List inbox emails with optional search and pagination
    if (action === "list") {
      let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults || 50}&labelIds=INBOX`;
      if (searchQuery) {
        url += `&q=${encodeURIComponent(searchQuery)}`;
      }
      if (pageToken) {
        url += `&pageToken=${pageToken}`;
      }

      const listResponse = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!listResponse.ok) {
        throw new Error("Error al listar correos");
      }

      const listData = await listResponse.json();
      const messages = [];

      for (const msg of (listData.messages || []).slice(0, maxResults || 50)) {
        const msgResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (msgResponse.ok) {
          const msgData = await msgResponse.json();
          const headers = msgData.payload?.headers || [];
          const labelIds = msgData.labelIds || [];
          
          messages.push({
            id: msg.id,
            threadId: msg.threadId,
            from: headers.find((h: any) => h.name === "From")?.value || "",
            subject: headers.find((h: any) => h.name === "Subject")?.value || "",
            date: headers.find((h: any) => h.name === "Date")?.value || "",
            snippet: msgData.snippet || "",
            isUnread: labelIds.includes("UNREAD"),
            hasAttachments: msgData.payload?.parts?.some((p: any) => p.filename && p.body?.attachmentId) || false,
          });
        }
      }

      return new Response(
        JSON.stringify({ messages, nextPageToken: listData.nextPageToken || null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // LIST TRASH - List emails in trash
    if (action === "listTrash") {
      const listResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults || 50}&labelIds=TRASH`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!listResponse.ok) {
        throw new Error("Error al listar papelera");
      }

      const listData = await listResponse.json();
      const messages = [];

      for (const msg of (listData.messages || []).slice(0, maxResults || 50)) {
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

    // GET UNREAD COUNT - Get unread message count
    if (action === "getUnreadCount") {
      const profileResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/labels/INBOX`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!profileResponse.ok) {
        throw new Error("Error al obtener conteo de no leídos");
      }

      const labelData = await profileResponse.json();

      return new Response(
        JSON.stringify({ 
          unreadCount: labelData.messagesUnread || 0,
          totalCount: labelData.messagesTotal || 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // MARK AS READ - single or batch
    if (action === "markAsRead") {
      const messageIds = messageId ? [messageId] : [];
      
      if (messageIds.length === 0) {
        throw new Error("messageId requerido");
      }

      let successCount = 0;
      let failCount = 0;

      for (const msgId of messageIds) {
        try {
          const modifyResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}/modify`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
            }
          );

          if (modifyResponse.ok) {
            successCount++;
            console.log("Marked as read successfully:", msgId);
          } else {
            failCount++;
            const errorText = await modifyResponse.text();
            console.log("Mark as read failed for", msgId, ":", modifyResponse.status, errorText);
          }
        } catch (e) {
          failCount++;
          console.log("Mark as read error for", msgId, ":", e);
        }
      }

      console.log(`Marked as read: ${successCount} success, ${failCount} failed`);

      return new Response(
        JSON.stringify({ success: true, successCount, failCount }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // TRASH - Move to trash (alias for delete)
    if (action === "trash") {
      if (!messageId) {
        throw new Error("messageId requerido");
      }

      const trashResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/trash`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!trashResponse.ok) {
        const errorText = await trashResponse.text();
        console.error("Trash failed:", errorText);
        throw new Error("Error al eliminar correo");
      }

      console.log("Email moved to trash:", messageId);

      return new Response(
        JSON.stringify({ success: true, messageId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SEND - Send email with optional attachments
    if (action === "send") {
      if (!to || !subject) {
        throw new Error("Destinatario y asunto requeridos");
      }

      const boundary = "boundary_" + Date.now();
      let emailContent: string;

      if (emailAttachments && emailAttachments.length > 0) {
        // Email with attachments - multipart/mixed
        let mimeMessage = [
          `From: ${email}`,
          `To: ${to}`,
          `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
          `MIME-Version: 1.0`,
          `Content-Type: multipart/mixed; boundary="${boundary}"`,
          "",
          `--${boundary}`,
          `Content-Type: text/html; charset=UTF-8`,
          `Content-Transfer-Encoding: base64`,
          "",
          btoa(unescape(encodeURIComponent(emailBody || ""))),
        ].join("\r\n");

        // Add attachments
        for (const att of emailAttachments) {
          mimeMessage += [
            "",
            `--${boundary}`,
            `Content-Type: ${att.mimeType}; name="${att.filename}"`,
            `Content-Disposition: attachment; filename="${att.filename}"`,
            `Content-Transfer-Encoding: base64`,
            "",
            att.content, // Already base64 encoded
          ].join("\r\n");
        }

        mimeMessage += `\r\n--${boundary}--`;
        emailContent = mimeMessage;
      } else {
        // Simple email without attachments
        emailContent = [
          `From: ${email}`,
          `To: ${to}`,
          `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
          `Content-Type: text/html; charset=utf-8`,
          `Content-Transfer-Encoding: base64`,
          "",
          btoa(unescape(encodeURIComponent(emailBody || ""))),
        ].join("\r\n");
      }

      const rawEmail = btoa(emailContent)
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

    // READ - Read full email
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

      let bodyHtml = "";
      let bodyText = "";
      
      const extractBody = (part: any) => {
        if (part.mimeType === "text/html" && part.body?.data) {
          bodyHtml = decodeBase64Utf8(part.body.data);
        } else if (part.mimeType === "text/plain" && part.body?.data) {
          bodyText = decodeBase64Utf8(part.body.data);
        }
        if (part.parts) {
          part.parts.forEach(extractBody);
        }
      };
      
      if (msgData.payload?.body?.data) {
        const mimeType = msgData.payload.mimeType;
        const decoded = decodeBase64Utf8(msgData.payload.body.data);
        if (mimeType === "text/html") {
          bodyHtml = decoded;
        } else {
          bodyText = decoded;
        }
      }
      
      if (msgData.payload?.parts) {
        msgData.payload.parts.forEach(extractBody);
      }
      
      // Extract attachments with attachmentId for download
      const attachments: { filename: string; mimeType: string; attachmentId: string; size: number }[] = [];
      const extractAttachments = (part: any) => {
        if (part.filename && part.body?.attachmentId) {
          attachments.push({ 
            filename: part.filename, 
            mimeType: part.mimeType,
            attachmentId: part.body.attachmentId,
            size: part.body.size || 0,
          });
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
        isUnread: msgData.labelIds?.includes("UNREAD") || false,
      };

      return new Response(
        JSON.stringify(emailDetail),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DOWNLOAD ATTACHMENT
    if (action === "downloadAttachment") {
      if (!messageId || !attachmentId) {
        throw new Error("messageId y attachmentId requeridos");
      }

      const attachmentResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!attachmentResponse.ok) {
        throw new Error("Error al descargar adjunto");
      }

      const attachmentData = await attachmentResponse.json();
      
      return new Response(
        JSON.stringify({ 
          data: attachmentData.data, // base64 URL-safe encoded
          size: attachmentData.size,
          filename: filename || "attachment",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DELETE - Move to trash
    if (action === "delete") {
      if (!messageId) {
        throw new Error("messageId requerido");
      }

      const trashResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/trash`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!trashResponse.ok) {
        const errorText = await trashResponse.text();
        console.error("Trash failed:", errorText);
        throw new Error("Error al eliminar correo");
      }

      console.log("Email moved to trash:", messageId);

      return new Response(
        JSON.stringify({ success: true, messageId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // UNTRASH - Recover from trash
    if (action === "untrash") {
      if (!messageId) {
        throw new Error("messageId requerido");
      }

      const untrashResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/untrash`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!untrashResponse.ok) {
        const errorText = await untrashResponse.text();
        console.error("Untrash failed:", errorText);
        throw new Error("Error al recuperar correo");
      }

      console.log("Email recovered from trash:", messageId);

      return new Response(
        JSON.stringify({ success: true, messageId }),
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
