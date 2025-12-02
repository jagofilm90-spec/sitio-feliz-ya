import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfBase64 } = await req.json();
    
    if (!pdfBase64) {
      throw new Error('No PDF data provided');
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Parsing CSF PDF with AI...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You are a document parser specialized in Mexican tax documents (Constancia de Situación Fiscal - CSF).
Extract the following fields from the CSF PDF and return them in a JSON format.

Required fields to extract:
- rfc: The RFC (tax ID) of the person/company
- razon_social: The legal name (Denominación/Razón Social)
- regimen_capital: The capital regime (S.A. de C.V., S. de R.L., etc.) - extract from the end of razon_social if present
- codigo_postal: Postal code
- tipo_vialidad: Street type (Calle, Avenida, Boulevard, etc.)
- nombre_vialidad: Street name
- numero_exterior: External number
- numero_interior: Internal number (if any)
- nombre_colonia: Neighborhood name
- nombre_localidad: Locality name
- nombre_municipio: Municipality/Delegation name
- nombre_entidad_federativa: State name
- entre_calle: Between street 1
- y_calle: Between street 2

Return ONLY a valid JSON object with these fields. Use null for fields not found.
For razon_social, remove the regime part (S.A. de C.V., etc.) if present and put it in regimen_capital instead.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Please extract the fiscal data from this CSF document:"
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${pdfBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    console.log("AI response:", content);

    if (!content) {
      throw new Error("No response from AI");
    }

    // Extract JSON from the response
    let parsedData;
    try {
      // Try to find JSON in the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      throw new Error("Failed to parse CSF data from AI response");
    }

    console.log("Parsed CSF data:", parsedData);

    return new Response(JSON.stringify({ data: parsedData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in parse-csf function:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
