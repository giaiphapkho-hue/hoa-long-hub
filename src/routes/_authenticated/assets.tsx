import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/crm/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Boxes, Search, AlertCircle } from "lucide-react";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/assets")({ component: Assets });

function Assets() {
  const [q, setQ] = useState("");
  const { data: assets = [] } = useQuery({
    queryKey: ["assets"],
    queryFn: async () => (await supabase.from("assets").select("*, sites(name), companies(name)").order("created_at", { ascending: false })).data ?? [],
  });
  const today = new Date().toISOString().slice(0, 10);
  const filtered = assets.filter((a: any) => [a.name, a.serial_number, a.companies?.name].join(" ").toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHeader title="Installed Base" description={`${assets.length} industrial assets across all customer sites`} />
      <div className="space-y-4 p-4 sm:p-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by name, serial, or customer…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((a: any) => {
            const overdue = a.next_maintenance_date && a.next_maintenance_date < today;
            return (
              <Link to="/assets/$id" params={{ id: a.id }} key={a.id}>
                <Card className="transition-all hover:border-primary/60 hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-foreground"><Boxes className="h-5 w-5" /></div>
                        <div>
                          <h3 className="font-semibold leading-tight">{a.name}</h3>
                          <p className="mt-0.5 text-xs text-muted-foreground">SN: {a.serial_number}</p>
                          <p className="text-xs text-muted-foreground">{a.companies?.name} · {a.sites?.name}</p>
                        </div>
                      </div>
                      {overdue && <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Overdue</Badge>}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <div><div className="text-muted-foreground">Capacity</div><div className="font-medium">{Number(a.load_capacity_kg ?? 0).toLocaleString()} kg</div></div>
                      <div><div className="text-muted-foreground">Next service</div><div className="font-medium">{fmtDate(a.next_maintenance_date)}</div></div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
