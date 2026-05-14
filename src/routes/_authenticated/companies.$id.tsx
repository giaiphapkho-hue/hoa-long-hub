import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/crm/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScoreBadge } from "./companies";
import { ArrowLeft, Building2, MapPin, User2, Boxes, Mail, Phone } from "lucide-react";
import { fmtMoney } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/companies/$id")({ component: CompanyDetail });

function CompanyDetail() {
  const { id } = Route.useParams();
  const { data } = useQuery({
    queryKey: ["company", id],
    queryFn: async () => {
      const [c, sites, contacts, assets, deals] = await Promise.all([
        supabase.from("companies").select("*").eq("id", id).single(),
        supabase.from("sites").select("*").eq("company_id", id),
        supabase.from("contacts").select("*").eq("company_id", id),
        supabase.from("assets").select("*").eq("company_id", id),
        supabase.from("deals").select("*").eq("company_id", id).order("updated_at", { ascending: false }),
      ]);
      return { company: c.data, sites: sites.data ?? [], contacts: contacts.data ?? [], assets: assets.data ?? [], deals: deals.data ?? [] };
    },
  });

  if (!data?.company) return <div className="p-8 text-muted-foreground">Loading…</div>;
  const c = data.company;

  return (
    <div>
      <PageHeader
        title={c.name}
        description={`${c.industry ?? "—"} · ${c.size ?? "—"} · ${fmtMoney(c.annual_revenue)} annual revenue`}
        actions={<Link to="/companies"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4" />Back</Button></Link>}
      />
      <div className="space-y-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <ScoreBadge score={c.lead_score} />
          <Badge variant={c.status === "active" ? "default" : "secondary"} className="capitalize">{c.status}</Badge>
          {c.website && <a className="text-sm text-primary hover:underline" href={c.website} target="_blank" rel="noreferrer">{c.website}</a>}
        </div>

        {c.ai_summary && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader><CardTitle className="text-base">AI Insights</CardTitle></CardHeader>
            <CardContent className="text-sm">{c.ai_summary}</CardContent>
          </Card>
        )}

        <Tabs defaultValue="sites">
          <TabsList>
            <TabsTrigger value="sites">Sites ({data.sites.length})</TabsTrigger>
            <TabsTrigger value="contacts">Contacts ({data.contacts.length})</TabsTrigger>
            <TabsTrigger value="assets">Assets ({data.assets.length})</TabsTrigger>
            <TabsTrigger value="deals">Deals ({data.deals.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="sites" className="grid gap-3 md:grid-cols-2">
            {data.sites.map(s => (
              <Card key={s.id}><CardContent className="p-4 flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <div><div className="font-medium">{s.name}</div><div className="text-xs text-muted-foreground">{s.address}, {s.city}, {s.country}</div><div className="mt-1"><Badge variant="secondary" className="text-xs">{s.site_type ?? "site"}</Badge></div></div>
              </CardContent></Card>
            ))}
          </TabsContent>

          <TabsContent value="contacts" className="grid gap-3 md:grid-cols-2">
            {data.contacts.map(p => (
              <Card key={p.id}><CardContent className="p-4 flex items-start gap-3">
                <User2 className="h-5 w-5 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="font-medium">{p.full_name}</span>{p.is_primary && <Badge className="text-[10px]">primary</Badge>}</div>
                  <div className="text-xs text-muted-foreground">{p.job_title}</div>
                  {p.email && <div className="mt-1 flex items-center gap-1 text-xs"><Mail className="h-3 w-3" />{p.email}</div>}
                  {p.phone && <div className="flex items-center gap-1 text-xs"><Phone className="h-3 w-3" />{p.phone}</div>}
                </div>
              </CardContent></Card>
            ))}
          </TabsContent>

          <TabsContent value="assets" className="grid gap-3 md:grid-cols-2">
            {data.assets.map(a => (
              <Link key={a.id} to="/assets/$id" params={{ id: a.id }}>
                <Card className="hover:border-primary/60"><CardContent className="p-4 flex items-start gap-3">
                  <Boxes className="h-5 w-5 text-muted-foreground" />
                  <div><div className="font-medium">{a.name}</div><div className="text-xs text-muted-foreground">SN: {a.serial_number} · {Number(a.load_capacity_kg ?? 0)}kg</div></div>
                </CardContent></Card>
              </Link>
            ))}
          </TabsContent>

          <TabsContent value="deals" className="grid gap-3 md:grid-cols-2">
            {data.deals.map(d => (
              <Card key={d.id}><CardContent className="p-4">
                <div className="flex items-start justify-between"><div className="font-medium">{d.title}</div><Badge variant="secondary" className="capitalize">{d.stage.replace(/_/g," ")}</Badge></div>
                <div className="mt-2 text-sm">{fmtMoney(d.value, d.currency)} · {d.probability}%</div>
              </CardContent></Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
