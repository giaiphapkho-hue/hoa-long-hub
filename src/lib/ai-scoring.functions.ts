import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const scoreCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ companyId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [{ data: company }, { data: deals }, { data: assets }] = await Promise.all([
      supabase.from("companies").select("*").eq("id", data.companyId).single(),
      supabase.from("deals").select("value, status").eq("company_id", data.companyId),
      supabase.from("assets").select("id").eq("company_id", data.companyId),
    ]);
    if (!company) throw new Error("Company not found");

    const apiKey = process.env.LOVABLE_API_KEY;
    const ctx = {
      name: company.name, industry: company.industry, size: company.size,
      annual_revenue: company.annual_revenue,
      deal_count: deals?.length ?? 0,
      open_deal_value: deals?.filter(d => d.status === "open").reduce((s, d) => s + Number(d.value ?? 0), 0) ?? 0,
      won_deal_value: deals?.filter(d => d.status === "won").reduce((s, d) => s + Number(d.value ?? 0), 0) ?? 0,
      installed_assets: assets?.length ?? 0,
    };

    let score = 0; let summary = "";
    if (apiKey) {
      try {
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "You score B2B industrial leads (0-100) for HLM Mechanical (cranes, hoists, MRO). Reply ONLY with JSON: {\"score\": number, \"summary\": string}. Summary must be 2 short sentences naming the top reason and one next-best action." },
              { role: "user", content: `Score this account:\n${JSON.stringify(ctx, null, 2)}` },
            ],
            response_format: { type: "json_object" },
          }),
        });
        if (res.ok) {
          const j = await res.json();
          const parsed = JSON.parse(j.choices?.[0]?.message?.content ?? "{}");
          score = Math.max(0, Math.min(100, Math.round(parsed.score ?? 0)));
          summary = String(parsed.summary ?? "").slice(0, 500);
        }
      } catch (e) { console.error("AI scoring failed", e); }
    }
    if (!summary) {
      // Heuristic fallback
      score = Math.min(100, Math.round(
        (ctx.installed_assets * 8) +
        (ctx.deal_count * 5) +
        (ctx.open_deal_value > 100000 ? 25 : ctx.open_deal_value / 4000) +
        (Number(ctx.annual_revenue ?? 0) > 10_000_000 ? 20 : 0)
      ));
      summary = `Heuristic score based on ${ctx.installed_assets} installed assets, ${ctx.deal_count} deals, and $${Math.round(ctx.open_deal_value).toLocaleString()} in open value. Recommend prioritizing technical discovery.`;
    }

    await supabase.from("companies").update({ lead_score: score, ai_summary: summary }).eq("id", data.companyId);
    return { score, summary };
  });
