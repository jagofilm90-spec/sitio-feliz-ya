import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Retry helper for network calls with exponential backoff
async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  maxRetries = 3,
  baseDelay = 1000
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      lastError = error;
      console.error(`Fetch attempt ${attempt + 1} failed:`, error.message);
      
      // Don't retry on abort
      if (error.name === 'AbortError') {
        throw new Error('La solicitud tardó demasiado. Intente de nuevo.');
      }
      
      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new Error(`Error de conexión después de ${maxRetries} intentos: ${lastError?.message || 'Unknown error'}`);
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const GMAIL_CLIENT_ID = Deno.env.get("GMAIL_CLIENT_ID");
  const GMAIL_CLIENT_SECRET = Deno.env.get("GMAIL_CLIENT_SECRET");

  try {
    const response = await fetchWithRetry("https://oauth2.googleapis.com/token", {
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
  } catch (error: any) {
    console.error("Token refresh error:", error.message);
    return null;
  }
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

    const { action, email, to, cc, bcc, subject, body: emailBody, maxResults, messageId, searchQuery, attachmentId, filename, attachments: emailAttachments, pageToken, fileContent, fileName, mimeType: fileMimeType } = await req.json();

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
      const limit = Math.min(maxResults || 30, 30); // Cap at 30 for performance
      let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${limit}&labelIds=INBOX`;
      if (searchQuery) {
        url += `&q=${encodeURIComponent(searchQuery)}`;
      }
      if (pageToken) {
        url += `&pageToken=${pageToken}`;
      }

      const listResponse = await fetchWithRetry(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }, 2, 500);

      if (!listResponse.ok) {
        const errorText = await listResponse.text();
        console.error("List error:", listResponse.status, errorText);
        throw new Error("Error al listar correos");
      }

      const listData = await listResponse.json();
      const messageIds = (listData.messages || []).slice(0, limit);
      
      // Fetch message details in parallel batches of 10
      const messages: any[] = [];
      const batchSize = 10;
      
      for (let i = 0; i < messageIds.length; i += batchSize) {
        const batch = messageIds.slice(i, i + batchSize);
        
        const batchResults = await Promise.allSettled(
          batch.map(async (msg: any) => {
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 8000);
              
              const msgResponse = await fetch(
                `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
                {
                  headers: { Authorization: `Bearer ${accessToken}` },
                  signal: controller.signal,
                }
              );
              
              clearTimeout(timeoutId);
              
              if (!msgResponse.ok) return null;
              
              const msgData = await msgResponse.json();
              const headers = msgData.payload?.headers || [];
              const labelIds = msgData.labelIds || [];
              
              return {
                id: msg.id,
                threadId: msg.threadId,
                from: headers.find((h: any) => h.name === "From")?.value || "",
                subject: headers.find((h: any) => h.name === "Subject")?.value || "",
                date: headers.find((h: any) => h.name === "Date")?.value || "",
                snippet: msgData.snippet || "",
                isUnread: labelIds.includes("UNREAD"),
                hasAttachments: msgData.payload?.parts?.some((p: any) => p.filename && p.body?.attachmentId) || false,
              };
            } catch (e) {
              console.error(`Failed to fetch message ${msg.id}:`, e);
              return null;
            }
          })
        );
        
        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value) {
            messages.push(result.value);
          }
        }
      }

      return new Response(
        JSON.stringify({ messages, nextPageToken: listData.nextPageToken || null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // LIST TRASH - List emails in trash
    if (action === "listTrash") {
      const limit = Math.min(maxResults || 30, 30);
      const listResponse = await fetchWithRetry(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${limit}&labelIds=TRASH`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
        2, 500
      );

      if (!listResponse.ok) {
        throw new Error("Error al listar papelera");
      }

      const listData = await listResponse.json();
      const messageIds = (listData.messages || []).slice(0, limit);
      const messages: any[] = [];
      
      // Parallel fetch in batches of 10
      const batchSize = 10;
      for (let i = 0; i < messageIds.length; i += batchSize) {
        const batch = messageIds.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
          batch.map(async (msg: any) => {
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 8000);
              const msgResponse = await fetch(
                `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
                { headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal }
              );
              clearTimeout(timeoutId);
              if (!msgResponse.ok) return null;
              const msgData = await msgResponse.json();
              const headers = msgData.payload?.headers || [];
              return {
                id: msg.id,
                threadId: msg.threadId,
                from: headers.find((h: any) => h.name === "From")?.value || "",
                subject: headers.find((h: any) => h.name === "Subject")?.value || "",
                date: headers.find((h: any) => h.name === "Date")?.value || "",
                snippet: msgData.snippet || "",
              };
            } catch { return null; }
          })
        );
        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value) messages.push(result.value);
        }
      }

      return new Response(
        JSON.stringify({ messages }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET UNREAD COUNT - Get unread message count
    if (action === "getUnreadCount") {
      const profileResponse = await fetchWithRetry(
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

    // MARK AS READ - single or batch using Gmail batchModify API
    if (action === "markAsRead") {
      // Support both single messageId and array of messageIds
      const messageIds = Array.isArray(messageId) ? messageId : (messageId ? [messageId] : []);
      
      if (messageIds.length === 0) {
        throw new Error("messageId requerido");
      }

      // Use batchModify for multiple messages (more efficient)
      if (messageIds.length > 1) {
        try {
          const batchResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/batchModify`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ 
                ids: messageIds,
                removeLabelIds: ["UNREAD"] 
              }),
            }
          );

          if (batchResponse.ok) {
            console.log(`Batch marked as read: ${messageIds.length} messages`);
            return new Response(
              JSON.stringify({ success: true, successCount: messageIds.length, failCount: 0 }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          } else {
            const errorText = await batchResponse.text();
            console.log("Batch mark as read failed:", batchResponse.status, errorText);
            throw new Error("Error al marcar correos como leídos en lote");
          }
        } catch (e) {
          console.log("Batch mark as read error:", e);
          throw e;
        }
      }

      // Single message - use individual modify
      try {
        const modifyResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageIds[0]}/modify`,
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
          console.log("Marked as read successfully:", messageIds[0]);
          return new Response(
            JSON.stringify({ success: true, successCount: 1, failCount: 0 }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          const errorText = await modifyResponse.text();
          console.log("Mark as read failed:", modifyResponse.status, errorText);
          throw new Error("Error al marcar correo como leído");
        }
      } catch (e) {
        console.log("Mark as read error:", e);
        throw e;
      }
    }

    // MARK ALL INBOX AS READ - Mark ALL unread emails in inbox as read
    if (action === "markAllInboxAsRead") {
      console.log("Starting markAllInboxAsRead for:", email);
      let totalMarked = 0;
      let pageToken: string | null = null;
      
      // Fetch and mark unread messages in batches
      do {
        // Get unread messages
        let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=500&labelIds=INBOX&labelIds=UNREAD`;
        if (pageToken) {
          url += `&pageToken=${pageToken}`;
        }
        
        const listResponse = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!listResponse.ok) {
          console.error("Error listing unread messages:", await listResponse.text());
          break;
        }

        const listData = await listResponse.json();
        const messageIds = (listData.messages || []).map((m: any) => m.id);
        
        if (messageIds.length === 0) {
          console.log("No more unread messages to mark");
          break;
        }

        console.log(`Found ${messageIds.length} unread messages, marking as read...`);

        // Mark as read using batchModify (supports up to 1000 per call)
        const batchResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/batchModify`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ 
              ids: messageIds,
              removeLabelIds: ["UNREAD"] 
            }),
          }
        );

        if (!batchResponse.ok) {
          console.error("Batch mark failed:", await batchResponse.text());
          break;
        }

        totalMarked += messageIds.length;
        pageToken = listData.nextPageToken || null;
        
        console.log(`Marked ${totalMarked} messages so far, nextPage: ${pageToken ? 'yes' : 'no'}`);
      } while (pageToken);

      console.log(`Finished markAllInboxAsRead: ${totalMarked} messages marked`);
      
      return new Response(
        JSON.stringify({ success: true, totalMarked }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // TRASH - Move to trash (single or batch)
    if (action === "trash") {
      const messageIds = Array.isArray(messageId) ? messageId : (messageId ? [messageId] : []);
      
      if (messageIds.length === 0) {
        throw new Error("messageId requerido");
      }

      // Use batchModify for multiple messages
      if (messageIds.length > 1) {
        try {
          const batchResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/batchModify`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ 
                ids: messageIds,
                addLabelIds: ["TRASH"],
                removeLabelIds: ["INBOX"]
              }),
            }
          );

          if (batchResponse.ok) {
            console.log(`Batch trashed: ${messageIds.length} messages`);
            return new Response(
              JSON.stringify({ success: true, count: messageIds.length }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          } else {
            const errorText = await batchResponse.text();
            console.log("Batch trash failed:", batchResponse.status, errorText);
            throw new Error("Error al eliminar correos en lote");
          }
        } catch (e) {
          console.log("Batch trash error:", e);
          throw e;
        }
      }

      // Single message
      const trashResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageIds[0]}/trash`,
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

      console.log("Email moved to trash:", messageIds[0]);

      return new Response(
        JSON.stringify({ success: true, messageId: messageIds[0] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SEND - Send email with optional attachments, CC, BCC
    if (action === "send") {
      if (!to || !subject) {
        throw new Error("Destinatario y asunto requeridos");
      }

      const boundary = "boundary_" + Date.now();
      let emailContent: string;

      // Build headers array
      const headers = [
        `From: ${email}`,
        `To: ${to}`,
      ];
      
      // Add CC if provided
      if (cc) {
        headers.push(`Cc: ${cc}`);
      }
      
      // Add BCC if provided
      if (bcc) {
        headers.push(`Bcc: ${bcc}`);
      }
      
      headers.push(`Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`);

      if (emailAttachments && emailAttachments.length > 0) {
        // Email with attachments - multipart/mixed
        let mimeMessage = [
          ...headers,
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
          ...headers,
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

      let msgResponse: Response;
      try {
        msgResponse = await fetchWithRetry(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
      } catch (networkError: any) {
        console.error("Network error reading email:", networkError.message);
        return new Response(
          JSON.stringify({ error: `Error de red: ${networkError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!msgResponse.ok) {
        const errorText = await msgResponse.text();
        console.error("Gmail read error:", msgResponse.status, errorText);
        
        // If 404, the email was deleted or doesn't exist
        if (msgResponse.status === 404) {
          return new Response(
            JSON.stringify({ error: "Correo no encontrado o eliminado" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        // If 401, token might be invalid
        if (msgResponse.status === 401) {
          return new Response(
            JSON.stringify({ error: "Token expirado, reconecta la cuenta" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        throw new Error(`Error al leer correo: ${msgResponse.status}`);
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

      const attachmentResponse = await fetchWithRetry(
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

    // UPLOAD TO DRIVE - Upload a file to Google Drive and return shareable link
    if (action === "uploadToDrive") {
      if (!fileContent || !fileName) {
        throw new Error("fileContent y fileName requeridos");
      }

      console.log(`Uploading to Drive: ${fileName} (${fileMimeType || 'application/octet-stream'})`);

      // Step 1: Create file metadata with resumable upload
      const metadataResponse = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "multipart/related; boundary=boundary_drive",
          },
          body: [
            "--boundary_drive",
            "Content-Type: application/json; charset=UTF-8",
            "",
            JSON.stringify({
              name: fileName,
              mimeType: fileMimeType || "application/octet-stream",
            }),
            "--boundary_drive",
            `Content-Type: ${fileMimeType || "application/octet-stream"}`,
            "Content-Transfer-Encoding: base64",
            "",
            fileContent,
            "--boundary_drive--",
          ].join("\r\n"),
        }
      );

      if (!metadataResponse.ok) {
        const errorText = await metadataResponse.text();
        console.error("Drive upload failed:", errorText);
        throw new Error("Error al subir archivo a Drive");
      }

      const fileData = await metadataResponse.json();
      console.log("File uploaded to Drive:", fileData.id);

      // Step 2: Set file permissions to anyone with link can view
      const permResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileData.id}/permissions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            role: "reader",
            type: "anyone",
          }),
        }
      );

      if (!permResponse.ok) {
        console.error("Permission setting failed:", await permResponse.text());
      }

      // Step 3: Get shareable link
      const shareLink = `https://drive.google.com/file/d/${fileData.id}/view?usp=sharing`;
      console.log("Shareable link:", shareLink);

      return new Response(
        JSON.stringify({ 
          success: true, 
          fileId: fileData.id,
          shareLink,
          fileName,
        }),
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
