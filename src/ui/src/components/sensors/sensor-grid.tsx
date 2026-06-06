"use client";

import { useEffect, useState, useCallback } from "react";
import { SensorCard } from "./sensor-card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Sensor {
  id: string;
  name: string;
  type: string;
  unit: string;
  device: {
    name: string;
    zone: { name: string; hospital: { name: string } };
  };
  readings: { value: number; timestamp: string }[];
}

const PAGE_SIZE = 20;

export function SensorGrid() {
  const [sensors,    setSensors]    = useState<Sensor[]>([]);
  const [total,      setTotal]      = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page,       setPage]       = useState(1);
  const [loading,    setLoading]    = useState(false);

  const loadSensors = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/sensors?page=${p}&limit=${PAGE_SIZE}`);
      const data = await res.json();
      setSensors(data.sensors);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSensors(page); }, [page]);

  function getPageNumbers(): (number | "...")[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 4)              return [1, 2, 3, 4, 5, "...", totalPages];
    if (page >= totalPages - 3) return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, "...", page - 1, page, page + 1, "...", totalPages];
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <div key={i} className="rounded-lg border p-4 space-y-3 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="h-4 bg-muted rounded w-24" />
                <div className="h-5 bg-muted rounded-full w-16" />
              </div>
              <div className="h-8 bg-muted rounded w-20" />
              <div className="h-3 bg-muted rounded w-32" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (sensors.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No sensors found.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {sensors.map((sensor) => (
          <SensorCard key={sensor.id} sensor={sensor} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1 pt-2">
          <p className="text-sm text-muted-foreground">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} sensors
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline" size="icon" className="h-8 w-8"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {getPageNumbers().map((num, i) =>
              num === "..." ? (
                <span key={`e-${i}`} className="px-1 text-sm text-muted-foreground">…</span>
              ) : (
                <Button
                  key={num}
                  variant={page === num ? "default" : "outline"}
                  size="icon" className="h-8 w-8 text-sm"
                  onClick={() => setPage(num as number)}
                >
                  {num}
                </Button>
              )
            )}

            <Button
              variant="outline" size="icon" className="h-8 w-8"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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