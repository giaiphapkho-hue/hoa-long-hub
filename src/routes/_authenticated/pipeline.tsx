import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/crm/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Plus, GripVertical } from "lucide-react";
import { fmtMoney } from "@/lib/format";
import { STAGES, type StageId } from "@/lib/pipeline";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pipeline")({ component: Pipeline });

function Pipeline() {
  const qc = useQueryClient();
  const { canEditSales } = useAuth();
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const { data: deals = [] } = useQuery({
    queryKey: ["deals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("deals").select("*, companies(name)").order("position");
      if (error) throw error;
      return data as any[];
    },
  });

  const grouped = useMemo(() => {
    const map = Object.fromEntries(STAGES.map(s => [s.id, [] as any[]]));
    deals.forEach(d => map[d.stage]?.push(d));
    return map;
  }, [deals]);

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    if (!e.over) return;
    const dealId = String(e.active.id);
    const newStage = String(e.over.id) as StageId;
    const deal = deals.find(d => d.id === dealId);
    if (!deal || deal.stage === newStage) return;
    if (!canEditSales) return toast.error("You need Sales role to move deals");
    const status = newStage === "closed_won" ? "won" : deal.status;
    qc.setQueryData(["deals"], (old: any[] = []) => old.map(d => d.id === dealId ? { ...d, stage: newStage, status } : d));
    const { error } = await supabase.from("deals").update({ stage: newStage, status }).eq("id", dealId);
    if (error) { toast.error(error.message); qc.invalidateQueries({ queryKey: ["deals"] }); }
  }

  const activeDeal = deals.find(d => d.id === activeId);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <PageHeader title="Sales Pipeline" description="Industrial B2B opportunities through 7 stages" actions={canEditSales && <NewDealButton />} />
      <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))} onDragEnd={onDragEnd}>
        <div className="flex flex-1 gap-3 overflow-x-auto p-4">
          {STAGES.map(s => {
            const items = grouped[s.id] ?? [];
            const total = items.reduce((sum, d) => sum + Number(d.value ?? 0), 0);
            return (
              <Column key={s.id} id={s.id}>
                <div className="mb-3 flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                    <h3 className="text-sm font-semibold">{s.label}</h3>
                    <span className="text-xs text-muted-foreground">{items.length}</span>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">{fmtMoney(total)}</span>
                </div>
                <div className="space-y-2">
                  {items.map(d => <DealCard key={d.id} deal={d} />)}
                </div>
              </Column>
            );
          })}
        </div>
        <DragOverlay>{activeDeal && <DealCard deal={activeDeal} dragging />}</DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`flex w-72 shrink-0 flex-col rounded-lg border bg-muted/40 p-2 transition-colors ${isOver ? "border-primary bg-primary/5" : ""}`}>
      {children}
    </div>
  );
}

function DealCard({ deal, dragging }: { deal: any; dragging?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: deal.id });
  return (
    <Card ref={setNodeRef} {...attributes} {...listeners} className={`cursor-grab p-3 transition-all ${isDragging ? "opacity-30" : ""} ${dragging ? "shadow-2xl rotate-1" : "hover:shadow-md"}`}>
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{deal.title}</div>
          <div className="truncate text-xs text-muted-foreground">{deal.companies?.name ?? "—"}</div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm font-semibold">{fmtMoney(deal.value, deal.currency)}</span>
            <span className="text-[11px] text-muted-foreground">{deal.probability}%</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

function NewDealButton() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", value: "", company_id: "", stage: "prospecting" as StageId });
  const { data: companies = [] } = useQuery({ queryKey: ["companies-min"], queryFn: async () => (await supabase.from("companies").select("id,name").order("name")).data ?? [] });

  async function create() {
    const { error } = await supabase.from("deals").insert({ title: form.title, value: Number(form.value || 0), company_id: form.company_id || null, stage: form.stage });
    if (error) return toast.error(error.message);
    toast.success("Deal created");
    setOpen(false);
    setForm({ title: "", value: "", company_id: "", stage: "prospecting" });
    qc.invalidateQueries({ queryKey: ["deals"] });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4" />New Deal</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New Deal</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Value (USD)</Label><Input type="number" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} /></div>
            <div><Label>Stage</Label>
              <Select value={form.stage} onValueChange={v => setForm({ ...form, stage: v as StageId })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STAGES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Company</Label>
            <Select value={form.company_id} onValueChange={v => setForm({ ...form, company_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter><Button onClick={create} disabled={!form.title}>Create</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
