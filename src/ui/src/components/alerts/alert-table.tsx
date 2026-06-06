"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface AlertItem {
  id: string;
  message: string;
  severity: string;
  value: number;
  threshold: number;
  acknowledged: boolean;
  createdAt: string;
  sensor: {
    name: string;
    unit: string;
    device: { name: string; zone: { name: string; hospital: { name: string } } };
  };
}

interface AlertTableProps {
  alerts: AlertItem[];
  total: number;
  totalPages: number;
  page: number;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
  onAcknowledge: (id: string) => void;
}

const severityVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  CRITICAL: "destructive",
  HIGH:     "destructive",
  MEDIUM:   "default",
  LOW:      "secondary",
};

export function AlertTable({
  alerts,
  total,
  totalPages,
  page,
  onPageChange,
  onAcknowledge,
}: AlertTableProps) {
  function getPageNumbers(): (number | "...")[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 4)              return [1, 2, 3, 4, 5, "...", totalPages];
    if (page >= totalPages - 3) return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, "...", page - 1, page, page + 1, "...", totalPages];
  }

  if (alerts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No alerts found.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Severity</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Sensor</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {alerts.map((alert) => (
              <TableRow
                key={alert.id}
                className={alert.acknowledged ? "opacity-60" : ""}
              >
                <TableCell>
                  <Badge variant={severityVariant[alert.severity] ?? "secondary"}>
                    {alert.severity}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-xs truncate">{alert.message}</TableCell>
                <TableCell>{alert.sensor.name}</TableCell>
                <TableCell className="text-sm">
                  {alert.sensor.device.zone.hospital.name} /{" "}
                  {alert.sensor.device.zone.name}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                </TableCell>
                <TableCell>
                  {alert.acknowledged ? (
                    <span className="text-xs text-muted-foreground">Acknowledged</span>
                  ) : (
                    <span className="text-xs text-orange-600 font-medium">Active</span>
                  )}
                </TableCell>
                <TableCell>
                  {!alert.acknowledged && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onAcknowledge(alert.id)}
                      title="Acknowledge"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-muted-foreground">
            {(page - 1) * 10 + 1}–{Math.min(page * 10, total)} of {total} alerts
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline" size="icon" className="h-8 w-8"
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {getPageNumbers().map((num, i) =>
              num === "..." ? (
                <span key={`ellipsis-${i}`} className="px-1 text-sm text-muted-foreground">…</span>
              ) : (
                <Button
                  key={num}
                  variant={page === num ? "default" : "outline"}
                  size="icon" className="h-8 w-8 text-sm"
                  onClick={() => onPageChange(num as number)}
                >
                  {num}
                </Button>
              )
            )}

            <Button
              variant="outline" size="icon" className="h-8 w-8"
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}