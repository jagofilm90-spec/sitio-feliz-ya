import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const cors_headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors_headers });
  }

  try {
    const { documentoId, filePath } = await req.json();
    
    if (!documentoId || !filePath) {
      throw new Error("documentoId and filePath are required");
    }

    // Crear cliente de Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Descargar el PDF del storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("empleados-documentos")
      .download(filePath);

    if (downloadError) {
      console.error("Error downloading file:", downloadError);
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    // Convertir el blob a base64 (en chunks para evitar stack overflow)
    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunkSize = 0x8000; // 32KB chunks
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64 = btoa(binary);
    
    // Detectar tipo de archivo por extensión
    const fileExtension = filePath.split('.').pop()?.toLowerCase();
    const imageExtensions = ['jpg', 'jpeg', 'png', 'webp'];
    const isImage = imageExtensions.includes(fileExtension || '');
    const mimeType = isImage ? `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}` : 'application/pdf';

    // Llamar a Lovable AI para extraer la fecha de vencimiento
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    console.log("Calling Lovable AI to extract expiry date...");
    
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "Eres un asistente que extrae información de licencias de conducir mexicanas. Tu tarea es encontrar la fecha de vencimiento. Responde SOLO con la fecha en formato YYYY-MM-DD. Si no encuentras la fecha, responde 'NO_ENCONTRADA'."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "¿Cuál es la fecha de vencimiento de esta licencia de conducir? Responde SOLO con la fecha en formato YYYY-MM-DD."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64}`
                }
              }
            ]
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }
      if (aiResponse.status === 402) {
        throw new Error("Payment required. Please add funds to your Lovable AI workspace.");
      }
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      throw new Error("Failed to extract date from AI");
    }

    const aiData = await aiResponse.json();
    const extractedDate = aiData.choices[0].message.content.trim();
    
    console.log("Extracted date:", extractedDate);

    let fechaVencimiento = null;
    
    if (extractedDate !== "NO_ENCONTRADA") {
      // Validar que la fecha esté en formato correcto
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (dateRegex.test(extractedDate)) {
        fechaVencimiento = extractedDate;
        
        // Actualizar el documento con la fecha de vencimiento
        const { error: updateError } = await supabase
          .from("empleados_documentos")
          .update({ fecha_vencimiento: fechaVencimiento })
          .eq("id", documentoId);

        if (updateError) {
          console.error("Error updating document:", updateError);
          throw updateError;
        }

        // Verificar si la licencia vence en los próximos 30 días
        const fechaVenc = new Date(fechaVencimiento);
        const hoy = new Date();
        const diasRestantes = Math.ceil((fechaVenc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

        if (diasRestantes <= 30 && diasRestantes >= 0) {
          // Obtener información del empleado y documento
          const { data: documento } = await supabase
            .from("empleados_documentos")
            .select(`
              empleado_id,
              empleados (nombre_completo)
            `)
            .eq("id", documentoId)
            .single();

          if (documento) {
            // Crear notificación
            await supabase.from("notificaciones").insert({
              tipo: "vencimiento_licencia",
              titulo: "Licencia próxima a vencer",
              descripcion: `La licencia de ${documento.empleados.nombre_completo} vence en ${diasRestantes} días (${fechaVencimiento})`,
              empleado_id: documento.empleado_id,
              documento_id: documentoId,
              fecha_vencimiento: fechaVencimiento,
            });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        fecha_vencimiento: fechaVencimiento,
        message: fechaVencimiento ? "Fecha extraída exitosamente" : "No se pudo extraer la fecha automáticamente"
      }),
      {
        headers: { ...cors_headers, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in extract-license-expiry:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...cors_headers, "Content-Type": "application/json" },
      }
    );
  }
});