import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/crm/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, FileText } from "lucide-react";
import { fmtDate, fmtMoney } from "@/lib/format";
import { toast } from "sonner";

type Line = { description: string; qty: number; unit_price: number };

export const Route = createFileRoute("/_authenticated/quotations")({ component: Quotations });

function Quotations() {
  const qc = useQueryClient();
  const { canEditSales } = useAuth();
  const [open, setOpen] = useState(false);
  const [companyId, setCompanyId] = useState("");
  const [lines, setLines] = useState<Line[]>([{ description: "", qty: 1, unit_price: 0 }]);
  const [taxRate, setTaxRate] = useState(0.1);

  const { data: quotes = [] } = useQuery({
    queryKey: ["quotes"],
    queryFn: async () => (await supabase.from("quotations").select("*, companies(name)").order("issue_date", { ascending: false })).data ?? [],
  });
  const { data: companies = [] } = useQuery({ queryKey: ["companies-min"], queryFn: async () => (await supabase.from("companies").select("id,name").order("name")).data ?? [] });

  const subtotal = lines.reduce((s, l) => s + l.qty * l.unit_price, 0);
  const taxAmt = subtotal * taxRate;
  const total = subtotal + taxAmt;

  async function create() {
    const { error } = await supabase.from("quotations").insert({
      quote_number: `Q-${Date.now().toString().slice(-6)}`,
      company_id: companyId || null,
      line_items: lines as any,
      subtotal, tax_rate: taxRate, tax_amount: taxAmt, total,
      expiry_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    });
    if (error) return toast.error(error.message);
    toast.success("Quotation created");
    setOpen(false); setLines([{ description: "", qty: 1, unit_price: 0 }]); setCompanyId("");
    qc.invalidateQueries({ queryKey: ["quotes"] });
  }

  return (
    <div>
      <PageHeader title="Quotations" description={`${quotes.length} quotes issued`} actions={canEditSales && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4" />New Quotation</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>New Quotation</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Customer</Label>
                <Select value={companyId} onValueChange={setCompanyId}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Line items</Label>
                {lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2">
                    <Input className="col-span-6" placeholder="Description" value={l.description} onChange={e => { const n = [...lines]; n[i].description = e.target.value; setLines(n); }} />
                    <Input className="col-span-2" type="number" placeholder="Qty" value={l.qty} onChange={e => { const n = [...lines]; n[i].qty = Number(e.target.value); setLines(n); }} />
                    <Input className="col-span-3" type="number" placeholder="Unit $" value={l.unit_price} onChange={e => { const n = [...lines]; n[i].unit_price = Number(e.target.value); setLines(n); }} />
                    <Button className="col-span-1" variant="ghost" size="icon" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setLines([...lines, { description: "", qty: 1, unit_price: 0 }])}><Plus className="h-4 w-4" />Add line</Button>
              </div>
              <div className="grid grid-cols-2 gap-4 rounded-md border p-3 text-sm">
                <div>Subtotal</div><div className="text-right">{fmtMoney(subtotal)}</div>
                <div>Tax ({Math.round(taxRate * 100)}%)</div><div className="text-right">{fmtMoney(taxAmt)}</div>
                <div className="font-semibold">Total</div><div className="text-right font-semibold">{fmtMoney(total)}</div>
              </div>
            </div>
            <DialogFooter><Button onClick={create}>Create quotation</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )} />
      <div className="grid gap-3 p-4 sm:p-6 md:grid-cols-2 xl:grid-cols-3">
        {quotes.map((q: any) => (
          <Card key={q.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-foreground"><FileText className="h-5 w-5" /></div>
                  <div><div className="font-semibold">{q.quote_number}</div><div className="text-xs text-muted-foreground">{q.companies?.name ?? "—"}</div></div>
                </div>
                <Badge variant="secondary" className="capitalize">{q.status}</Badge>
              </div>
              <div className="mt-3 flex items-end justify-between">
                <div className="text-xs text-muted-foreground">Issued {fmtDate(q.issue_date)} · expires {fmtDate(q.expiry_date)}</div>
                <div className="text-lg font-semibold">{fmtMoney(q.total, q.currency)}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
