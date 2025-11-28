import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GMAIL_CLIENT_ID = Deno.env.get("GMAIL_CLIENT_ID");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

    if (!GMAIL_CLIENT_ID) {
      throw new Error("GMAIL_CLIENT_ID no configurado");
    }

    const { email } = await req.json();
    
    if (!email) {
      throw new Error("Email requerido");
    }

    // Build OAuth URL
    const redirectUri = `${SUPABASE_URL}/functions/v1/gmail-callback`;
    const scope = encodeURIComponent("https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify");
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${GMAIL_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${scope}` +
      `&access_type=offline` +
      `&prompt=consent` +
      `&state=${encodeURIComponent(email)}`;

    console.log("Generated auth URL for email:", email);

    return new Response(
      JSON.stringify({ authUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in gmail-auth:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
