import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/crm/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, Wrench } from "lucide-react";
import { fmtDate, fmtMoney } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/assets/$id")({ component: AssetDetail });

function AssetDetail() {
  const { id } = Route.useParams();
  const { data } = useQuery({
    queryKey: ["asset", id],
    queryFn: async () => {
      const [a, m] = await Promise.all([
        supabase.from("assets").select("*, sites(*), companies(*)").eq("id", id).single(),
        supabase.from("maintenance_orders").select("*").eq("asset_id", id).order("scheduled_date", { ascending: false }),
      ]);
      return { asset: a.data, maint: m.data ?? [] };
    },
  });
  if (!data?.asset) return <div className="p-8 text-muted-foreground">Loading…</div>;
  const a: any = data.asset;
  const today = new Date().toISOString().slice(0, 10);
  const overdue = a.next_maintenance_date && a.next_maintenance_date < today;

  return (
    <div>
      <PageHeader
        title={a.name}
        description={`Serial ${a.serial_number} · Installed ${fmtDate(a.install_date)}`}
        actions={<Link to="/assets"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4" />Back</Button></Link>}
      />
      <div className="space-y-6 p-4 sm:p-6">
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Technical Asset Passport</CardTitle>
              <Badge variant={overdue ? "destructive" : "default"} className="capitalize">{overdue ? "Service overdue" : a.status}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Manufacturer" value={a.manufacturer} />
              <Field label="Model" value={a.model} />
              <Field label="Asset type" value={a.asset_type} />
              <Field label="Load capacity" value={`${Number(a.load_capacity_kg ?? 0).toLocaleString()} kg`} />
              <Field label="Install date" value={fmtDate(a.install_date)} />
              <Field label="Warranty expiry" value={fmtDate(a.warranty_expiry)} />
              <Field label="Maintenance interval" value={`${a.maintenance_interval_days} days`} />
              <Field label="Last service" value={fmtDate(a.last_maintenance_date)} />
              <Field label="Next service" value={fmtDate(a.next_maintenance_date)} highlight={overdue} />
              <Field label="Customer" value={a.companies?.name} />
              <Field label="Site" value={a.sites?.name} />
              <Field label="Location" value={`${a.sites?.city ?? ""}, ${a.sites?.country ?? ""}`} />
            </div>
            {a.drawing_url && <a className="mt-4 inline-flex items-center gap-2 text-sm text-primary hover:underline" href={a.drawing_url} target="_blank" rel="noreferrer"><FileText className="h-4 w-4" />View technical drawing</a>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Wrench className="h-5 w-5" />Service History</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.maint.map(m => (
                <div key={m.id} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <div className="font-medium">{m.title}</div>
                    <div className="text-xs text-muted-foreground">Scheduled {fmtDate(m.scheduled_date)} · {m.completed_date ? `Completed ${fmtDate(m.completed_date)}` : "Pending"}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm">{fmtMoney(m.cost)}</span>
                    <Badge variant={m.status === "completed" ? "default" : m.status === "overdue" ? "destructive" : "secondary"} className="capitalize">{m.status.replace(/_/g, " ")}</Badge>
                  </div>
                </div>
              ))}
              {data.maint.length === 0 && <p className="text-sm text-muted-foreground">No service records yet.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value, highlight }: { label: string; value: any; highlight?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 font-medium ${highlight ? "text-destructive" : ""}`}>{value || "—"}</div>
    </div>
  );
}
