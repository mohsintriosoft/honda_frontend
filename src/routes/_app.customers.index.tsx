import { Link } from "react-router-dom";
import { useState } from "react";

import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/data/StatusBadge";
import { customers } from "@/mocks/data";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials, formatCurrency, formatRelative } from "@/lib/format";
import { Filter, Search, Download, Sparkles, Plus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

export default function CustomersPage() {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const filtered = customers.filter(
    (c) =>
      !q ||
      c.name.toLowerCase().includes(q.toLowerCase()) ||
      c.phone.includes(q) ||
      c.vehicle.regNo.toLowerCase().includes(q.toLowerCase()),
  );

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <>
      <PageHeader
        title="Customer 360"
        description="Every Om Honda customer — vehicle, service, insurance, AMC, and AI interactions in one view."
        actions={
          <>
            <Button variant="outline" size="sm">
              <Download className="size-4" />
              Export
            </Button>

            <Button size="sm">
              <Plus className="size-4" />
              Add customer
            </Button>
          </>
        }
      />

      <div className="p-4 md:p-6 lg:p-8 space-y-4">
        {/* Saved views */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            "All customers",
            "Activa owners",
            "Inactive 180d+",
            "Insurance due 30d",
            "Top spenders",
          ].map((view, index) => (
            <button
              key={view}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${
                index === 0
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card hover:bg-accent"
              }`}
            >
              {view}
            </button>
          ))}

          <button className="shrink-0 rounded-full border border-dashed px-3 py-1 text-xs text-muted-foreground hover:bg-accent">
            + Save view
          </button>
        </div>

        <Card>
          <CardHeader className="flex-row items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />

              <Input
                placeholder="Search name, phone, registration…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-8"
              />
            </div>

            <Button variant="outline" size="sm">
              <Filter className="size-4" />
              Filters
            </Button>

            <Button variant="outline" size="sm">
              <Sparkles className="size-4 text-[color:var(--ai)]" />
              Ask AI
            </Button>
          </CardHeader>

          <CardContent className="p-0">
            {/* Bulk actions */}
            {selected.length > 0 && (
              <div className="flex items-center justify-between bg-primary/10 border-y px-4 py-2 text-sm">
                <span className="font-medium">{selected.length} selected</span>

                <div className="flex gap-2">
                  <Button size="sm" variant="ghost">
                    Add to campaign
                  </Button>

                  <Button size="sm" variant="ghost">
                    Tag
                  </Button>

                  <Button size="sm" variant="ghost">
                    Export
                  </Button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Customer</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Lifecycle</TableHead>
                    <TableHead>Insurance</TableHead>
                    <TableHead>AMC</TableHead>
                    <TableHead className="text-right">Spend</TableHead>
                    <TableHead>Last interaction</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filtered.slice(0, 30).map((c) => (
                    <TableRow key={c.id} className="cursor-pointer">
                      <TableCell>
                        <Checkbox
                          checked={selected.includes(c.id)}
                          onCheckedChange={() => toggle(c.id)}
                        />
                      </TableCell>

                      <TableCell>
                        <Link to={`/customers/${c.id}`} className="flex items-center gap-2.5 group">
                          <Avatar className="size-8">
                            <AvatarFallback className="text-xs">{initials(c.name)}</AvatarFallback>
                          </Avatar>

                          <div className="min-w-0">
                            <div className="font-medium group-hover:text-primary truncate">
                              {c.name}
                            </div>

                            <div className="text-xs text-muted-foreground">
                              {c.phone} • {c.branch}
                            </div>
                          </div>
                        </Link>
                      </TableCell>

                      <TableCell>
                        <div className="text-sm">{c.vehicle.model}</div>

                        <div className="text-xs text-muted-foreground font-mono">
                          {c.vehicle.regNo}
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="capitalize text-xs">
                          {c.lifecycleStage.replace(/_/g, " ")}
                        </span>
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={c.insurance.status} />
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={c.amc.status} />
                      </TableCell>

                      <TableCell className="text-right tabular-nums text-sm">
                        {formatCurrency(c.totalSpend)}
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        {formatRelative(c.lastInteractionAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="border-t px-4 py-3 text-xs text-muted-foreground flex justify-between items-center">
              <span>Showing 30 of {customers.length.toLocaleString()} customers</span>

              <div className="flex gap-1">
                <Button size="sm" variant="ghost" disabled>
                  Previous
                </Button>

                <Button size="sm" variant="ghost">
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
