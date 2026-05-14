import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/crm/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtDate, fmtMoney } from "@/lib/format";
import { Wrench, AlertCircle, CheckCircle2, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/maintenance")({ component: Maintenance });

function Maintenance() {
  const { data: orders = [] } = useQuery({
    queryKey: ["maint"],
    queryFn: async () => (await supabase.from("maintenance_orders").select("*, assets(name, serial_number, companies(name))").order("scheduled_date")).data ?? [],
  });
  const today = new Date().toISOString().slice(0, 10);
  const groups = {
    overdue: orders.filter((o: any) => o.status !== "completed" && o.scheduled_date < today),
    upcoming: orders.filter((o: any) => o.status === "scheduled" && o.scheduled_date >= today),
    inProgress: orders.filter((o: any) => o.status === "in_progress"),
    completed: orders.filter((o: any) => o.status === "completed").slice(0, 10),
  };

  return (
    <div>
      <PageHeader title="Maintenance / MRO" description={`${orders.length} work orders across the installed base`} />
      <div className="space-y-6 p-4 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={AlertCircle} label="Overdue" count={groups.overdue.length} tone="destructive" />
          <Stat icon={Clock} label="Upcoming" count={groups.upcoming.length} tone="primary" />
          <Stat icon={Wrench} label="In Progress" count={groups.inProgress.length} tone="chart-2" />
          <Stat icon={CheckCircle2} label="Completed" count={orders.filter((o: any) => o.status === "completed").length} tone="success" />
        </div>
        {(["overdue", "inProgress", "upcoming", "completed"] as const).map(k => (
          <Card key={k}>
            <CardHeader><CardTitle className="capitalize text-base">{k.replace("inProgress", "In Progress")} ({groups[k].length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {groups[k].map((m: any) => (
                <div key={m.id} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-medium">{m.title}</div>
                    <div className="text-xs text-muted-foreground">{m.assets?.name} · {m.assets?.companies?.name} · {fmtDate(m.scheduled_date)}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm">{fmtMoney(m.cost)}</span>
                    <Badge variant={m.status === "completed" ? "default" : k === "overdue" ? "destructive" : "secondary"} className="capitalize">{m.status.replace(/_/g, " ")}</Badge>
                  </div>
                </div>
              ))}
              {groups[k].length === 0 && <p className="text-sm text-muted-foreground">Nothing here.</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, count, tone }: any) {
  return (
    <Card><CardContent className="flex items-center gap-3 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-md" style={{ background: `color-mix(in oklab, var(--${tone}) 15%, transparent)`, color: `var(--${tone})` }}><Icon className="h-5 w-5" /></div>
      <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div><div className="text-2xl font-semibold">{count}</div></div>
    </CardContent></Card>
  );
}
