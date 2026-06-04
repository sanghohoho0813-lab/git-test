import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const { orgId, email, invitedBy } = await req.json();

  const { data: inv, error } = await supabase
    .from("invitations")
    .insert({ org_id: orgId, invited_by: invitedBy, email })
    .select()
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const siteUrl = Deno.env.get("SITE_URL") || "https://your-app.vercel.app";
  const inviteUrl = `${siteUrl}/auth?invite=${inv.token}`;

  return new Response(JSON.stringify({ inviteUrl }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
