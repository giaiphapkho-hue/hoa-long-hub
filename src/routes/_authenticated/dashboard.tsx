import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, KanbanSquare, Boxes, Wrench, TrendingUp, AlertTriangle } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { PageHeader } from "@/components/crm/page-header";
import { fmtMoney, fmtNumber } from "@/lib/format";
import { STAGES } from "@/lib/pipeline";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [companies, deals, assets, maint] = await Promise.all([
        supabase.from("companies").select("id", { count: "exact", head: true }),
        supabase.from("deals").select("id, value, stage, status, expected_close_date"),
        supabase.from("assets").select("id, status, next_maintenance_date"),
        supabase.from("maintenance_orders").select("id, status, scheduled_date, cost"),
      ]);
      const today = new Date().toISOString().slice(0, 10);
      const overdue = (assets.data ?? []).filter(a => a.next_maintenance_date && a.next_maintenance_date < today).length;
      const openValue = (deals.data ?? []).filter(d => d.status === "open").reduce((s, d) => s + Number(d.value ?? 0), 0);
      const wonValue = (deals.data ?? []).filter(d => d.status === "won").reduce((s, d) => s + Number(d.value ?? 0), 0);
      return {
        companies: companies.count ?? 0,
        openDeals: (deals.data ?? []).filter(d => d.status === "open").length,
        assets: (assets.data ?? []).length,
        maintOpen: (maint.data ?? []).filter(m => m.status !== "completed").length,
        overdue,
        openValue,
        wonValue,
        deals: deals.data ?? [],
        maint: maint.data ?? [],
      };
    },
  });

  const stageData = STAGES.map(s => ({
    name: s.label,
    deals: (stats?.deals ?? []).filter(d => d.stage === s.id).length,
    value: (stats?.deals ?? []).filter(d => d.stage === s.id).reduce((sum, d) => sum + Number(d.value ?? 0), 0),
    color: s.color,
  }));

  const statusData = [
    { name: "Open", value: (stats?.deals ?? []).filter(d => d.status === "open").length, color: "oklch(0.6 0.18 45)" },
    { name: "Won", value: (stats?.deals ?? []).filter(d => d.status === "won").length, color: "oklch(0.6 0.16 150)" },
    { name: "Lost", value: (stats?.deals ?? []).filter(d => d.status === "lost").length, color: "oklch(0.55 0.22 25)" },
  ];

  return (
    <div>
      <PageHeader title="Operations Dashboard" description="Real-time view of accounts, pipeline and installed base" />
      <div className="space-y-6 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard icon={Building2} label="Active Accounts" value={fmtNumber(stats?.companies)} accent="primary" />
          <KpiCard icon={KanbanSquare} label="Open Deals" value={fmtNumber(stats?.openDeals)} sub={fmtMoney(stats?.openValue)} accent="chart-2" />
          <KpiCard icon={Boxes} label="Installed Assets" value={fmtNumber(stats?.assets)} accent="chart-3" />
          <KpiCard icon={Wrench} label="Open Work Orders" value={fmtNumber(stats?.maintOpen)} sub={`${stats?.overdue ?? 0} overdue`} accent={stats && stats.overdue > 0 ? "destructive" : "chart-4"} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Pipeline by Stage</CardTitle>
                  <CardDescription>Deal count and weighted value across the funnel</CardDescription>
                </div>
                <Badge variant="secondary" className="gap-1"><TrendingUp className="h-3 w-3" />{fmtMoney(stats?.wonValue)} won</Badge>
              </div>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stageData} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0 0 0 / 8%)" />
                  <XAxis dataKey="name" angle={-25} textAnchor="end" height={60} tick={{ fontSize: 11, fill: "currentColor" }} />
                  <YAxis tick={{ fontSize: 11, fill: "currentColor" }} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Bar dataKey="deals" radius={[6, 6, 0, 0]}>
                    {stageData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Win Rate</CardTitle><CardDescription>Deal status mix</CardDescription></CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                    {statusData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div><CardTitle>Maintenance Schedule</CardTitle><CardDescription>Upcoming and overdue work orders</CardDescription></div>
              {stats && stats.overdue > 0 && <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />{stats.overdue} overdue assets</Badge>}
            </div>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(["scheduled","in_progress","completed","overdue"] as const).map(s => ({ name: s, count: (stats?.maint ?? []).filter(m => m.status === s).length }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0 0 0 / 8%)" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "currentColor" }} />
                <YAxis tick={{ fontSize: 11, fill: "currentColor" }} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Bar dataKey="count" fill="oklch(0.65 0.17 220)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, accent = "primary" }: { icon: any; label: string; value: string; sub?: string; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold sm:text-3xl">{value}</p>
            {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-md" style={{ background: `color-mix(in oklab, var(--${accent}) 15%, transparent)`, color: `var(--${accent})` }}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
