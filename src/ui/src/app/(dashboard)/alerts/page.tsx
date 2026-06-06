"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTable } from "@/components/alerts/alert-table";
import { AlertRuleForm } from "@/components/alerts/alert-rule-form";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";

interface AlertRule {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  severity: string;
  enabled: boolean;
  sensor: {
    name: string;
    unit: string;
    device: { name: string; zone: { name: string; hospital: { name: string } } };
  };
}

const PAGE_SIZE = 10;

export default function AlertsPage() {
  const [alerts,      setAlerts]      = useState<any[]>([]);
  const [rules,       setRules]       = useState<AlertRule[]>([]);
  const [sensors,     setSensors]     = useState<any[]>([]);
  const [total,       setTotal]       = useState(0);
  const [totalPages,  setTotalPages]  = useState(1);
  const [activeCount, setActiveCount] = useState(0);
  const [page,        setPage]        = useState(1);
  const [open,        setOpen]        = useState(false);

  const loadAlerts = useCallback(async (p: number) => {
    const res  = await fetch(`/api/alerts?page=${p}&limit=${PAGE_SIZE}`);
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.alerts ?? []);
    setAlerts(list);
    setTotal(data.total ?? list.length);
    setTotalPages(data.totalPages ?? 1);
    setActiveCount(data.activeCount ?? list.filter((a: any) => !a.acknowledged).length);
  }, []);

  async function loadRules() {
    const res = await fetch("/api/alert-rules");
    setRules(await res.json());
  }

  async function loadSensors() {
    const res  = await fetch("/api/sensors?page=1&limit=100");
    const data = await res.json();
    setSensors(Array.isArray(data) ? data : (data.sensors ?? []));
  }

  useEffect(() => { loadAlerts(page); }, [page, loadAlerts]);
  useEffect(() => { loadRules(); loadSensors(); }, []);

  async function handleAcknowledge(id: string) {
    await fetch("/api/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, acknowledged: true }),
    });
    loadAlerts(page);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Alerts</h1>
          <p className="text-muted-foreground">
            Monitor and manage alert rules and notifications
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Alert Rule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Alert Rule</DialogTitle>
            </DialogHeader>
            <AlertRuleForm
              sensors={sensors}
              onSuccess={() => {
                setOpen(false);
                loadRules();
                loadAlerts(1);
                setPage(1);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="alerts">
        <TabsList>
          <TabsTrigger value="alerts">
            Alerts {activeCount > 0 && `(${activeCount} active)`}
          </TabsTrigger>
          <TabsTrigger value="rules">
            Rules {rules.length > 0 && `(${rules.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="mt-4">
          <AlertTable
            alerts={alerts}
            total={total}
            totalPages={totalPages}
            page={page}
            onPageChange={setPage}
            onRefresh={() => loadAlerts(page)}
            onAcknowledge={handleAcknowledge}
          />
        </TabsContent>

        <TabsContent value="rules" className="mt-4">
          <div className="space-y-2">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div>
                  <p className="font-medium">{rule.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {rule.sensor.name}: {rule.condition} {rule.threshold}{" "}
                    {rule.sensor.unit}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded ${
                    rule.severity === "CRITICAL" ? "bg-red-100 text-red-800" :
                    rule.severity === "HIGH"     ? "bg-orange-100 text-orange-800" :
                    rule.severity === "MEDIUM"   ? "bg-yellow-100 text-yellow-800" :
                                                   "bg-blue-100 text-blue-800"
                  }`}>
                    {rule.severity}
                  </span>
                  <span className={`text-xs ${rule.enabled ? "text-green-600" : "text-muted-foreground"}`}>
                    {rule.enabled ? "Active" : "Disabled"}
                  </span>
                </div>
              </div>
            ))}
            {rules.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No alert rules configured.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}