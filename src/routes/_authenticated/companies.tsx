import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/crm/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Building2, Sparkles } from "lucide-react";
import { fmtMoney } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/companies")({ component: Companies });

function Companies() {
  const qc = useQueryClient();
  const { canEditSales } = useAuth();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", industry: "", size: "", website: "", annual_revenue: "" });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = companies.filter(c => c.name.toLowerCase().includes(q.toLowerCase()) || (c.industry ?? "").toLowerCase().includes(q.toLowerCase()));

  async function create() {
    const payload = { ...form, annual_revenue: form.annual_revenue ? Number(form.annual_revenue) : null };
    const { error } = await supabase.from("companies").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Company created");
    setOpen(false);
    setForm({ name: "", industry: "", size: "", website: "", annual_revenue: "" });
    qc.invalidateQueries({ queryKey: ["companies"] });
  }

  return (
    <div>
      <PageHeader
        title="Accounts"
        description={`${companies.length} companies in your book of business`}
        actions={canEditSales && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4" />New Account</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Account</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div><Label>Company name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Industry</Label><Input value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} placeholder="Manufacturing" /></div>
                  <div><Label>Size</Label><Input value={form.size} onChange={e => setForm({ ...form, size: e.target.value })} placeholder="200-500" /></div>
                </div>
                <div><Label>Website</Label><Input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="https://" /></div>
                <div><Label>Annual revenue (USD)</Label><Input type="number" value={form.annual_revenue} onChange={e => setForm({ ...form, annual_revenue: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={create} disabled={!form.name}>Create</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      />
      <div className="space-y-4 p-4 sm:p-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search companies or industry…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(c => (
            <Link to="/companies/$id" params={{ id: c.id }} key={c.id}>
              <Card className="transition-all hover:border-primary/60 hover:shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-foreground"><Building2 className="h-5 w-5" /></div>
                      <div>
                        <h3 className="font-semibold">{c.name}</h3>
                        <p className="text-xs text-muted-foreground">{c.industry || "—"} · {c.size || "—"}</p>
                      </div>
                    </div>
                    <ScoreBadge score={c.lead_score} />
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Revenue: {fmtMoney(c.annual_revenue)}</span>
                    <Badge variant={c.status === "active" ? "default" : "secondary"} className="capitalize">{c.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {filtered.length === 0 && (
            <Card className="md:col-span-2 xl:col-span-3"><CardContent className="p-8 text-center text-sm text-muted-foreground">No companies match your search.</CardContent></Card>
          )}
        </div>
      </div>
    </div>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  const tone = score >= 80 ? "bg-success/15 text-success" : score >= 50 ? "bg-warning/20 text-warning-foreground" : "bg-muted text-muted-foreground";
  return <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${tone}`}><Sparkles className="h-3 w-3" />{score}</span>;
}
