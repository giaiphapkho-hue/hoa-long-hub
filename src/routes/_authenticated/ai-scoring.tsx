import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { scoreCompany } from "@/lib/ai-scoring.functions";
import { PageHeader } from "@/components/crm/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { ScoreBadge } from "./companies";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ai-scoring")({ component: AIScoring });

function AIScoring() {
  const qc = useQueryClient();
  const score = useServerFn(scoreCompany);
  const [loading, setLoading] = useState<string | null>(null);
  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => (await supabase.from("companies").select("*").order("lead_score", { ascending: false })).data ?? [],
  });

  async function rescore(id: string) {
    setLoading(id);
    try {
      const r = await score({ data: { companyId: id } });
      toast.success(`Scored: ${r.score}`);
      qc.invalidateQueries({ queryKey: ["companies"] });
    } catch (e: any) { toast.error(e.message); } finally { setLoading(null); }
  }

  async function rescoreAll() {
    for (const c of companies) {
      setLoading(c.id);
      try { await score({ data: { companyId: c.id } }); } catch {}
    }
    setLoading(null);
    qc.invalidateQueries({ queryKey: ["companies"] });
    toast.success("All accounts scored");
  }

  return (
    <div>
      <PageHeader title="AI Lead Scoring" description="Prioritize accounts using Lovable AI" actions={<Button onClick={rescoreAll} disabled={!!loading}><Sparkles className="h-4 w-4" />Rescore all</Button>} />
      <div className="grid gap-3 p-4 sm:p-6 md:grid-cols-2">
        {companies.map(c => (
          <Card key={c.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.industry}</div>
                </div>
                <div className="flex items-center gap-2">
                  <ScoreBadge score={c.lead_score} />
                  <Button size="sm" variant="outline" disabled={loading === c.id} onClick={() => rescore(c.id)}>
                    {loading === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Rescore
                  </Button>
                </div>
              </div>
              {c.ai_summary && <p className="mt-3 text-sm text-muted-foreground">{c.ai_summary}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
