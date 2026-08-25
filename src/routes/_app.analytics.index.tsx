import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { callTrend, campaigns } from "@/mocks/data";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Pie,
  PieChart,
  Cell,
  Legend,
} from "recharts";
import { MetricTile } from "@/components/data/KpiCard";

const advisorPerf = [
  {
    name: "Anil",
    booked: 86,
    completed: 78,
  },
  {
    name: "Ravi",
    booked: 64,
    completed: 60,
  },
  {
    name: "Sunita",
    booked: 92,
    completed: 81,
  },
  {
    name: "Mohit",
    booked: 51,
    completed: 47,
  },
];

const dispositionMix = [
  {
    name: "Booked",
    value: 326,
    c: "var(--chart-1)",
  },
  {
    name: "Interested",
    value: 248,
    c: "var(--chart-2)",
  },
  {
    name: "Callback",
    value: 92,
    c: "var(--chart-3)",
  },
  {
    name: "Not interested",
    value: 140,
    c: "var(--chart-4)",
  },
  {
    name: "No answer",
    value: 184,
    c: "var(--chart-5)",
  },
];

export default function AnalyticsPage() {
  const totalBooked = campaigns.reduce((sum, campaign) => sum + campaign.totals.booked, 0);

  const totalRevenue = campaigns.reduce((sum, campaign) => sum + campaign.totals.revenue, 0);

  return (
    <>
      <PageHeader
        title="Reports & Analytics"
        description="Across all campaigns, channels, and branches."
      />

      <div className="p-4 md:p-6 lg:p-8 space-y-4">
        {/* KPI Metrics */}
        <div className="grid gap-3 md:grid-cols-4">
          <MetricTile label="Calls (30d)" value="18,420" tone="info" />

          <MetricTile label="Bookings (30d)" value={totalBooked} tone="success" />

          <MetricTile
            label="Revenue attributed"
            value={`₹${(totalRevenue / 100000).toFixed(1)}L`}
            tone="ai"
          />

          <MetricTile label="Workshop utilization" value="64%" />
        </div>

        <Tabs defaultValue="campaign">
          <TabsList>
            <TabsTrigger value="campaign">Campaigns</TabsTrigger>

            <TabsTrigger value="conversion">Conversion</TabsTrigger>

            <TabsTrigger value="advisor">Advisors</TabsTrigger>

            <TabsTrigger value="workshop">Workshop</TabsTrigger>
          </TabsList>

          {/* Campaign */}
          <TabsContent value="campaign" className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-display">Call volume trend</CardTitle>
              </CardHeader>

              <CardContent className="h-64">
                <ResponsiveContainer>
                  <AreaChart data={callTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />

                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />

                    <YAxis tick={{ fontSize: 11 }} />

                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />

                    <Area
                      type="monotone"
                      dataKey="calls"
                      stroke="var(--chart-1)"
                      fill="var(--chart-1)"
                      fillOpacity={0.2}
                    />

                    <Area
                      type="monotone"
                      dataKey="connected"
                      stroke="var(--chart-2)"
                      fill="var(--chart-2)"
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-display">Disposition mix</CardTitle>
              </CardHeader>

              <CardContent className="h-64">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={dispositionMix}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={80}
                    >
                      {dispositionMix.map((d) => (
                        <Cell key={d.name} fill={d.c} />
                      ))}
                    </Pie>

                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />

                    <Legend
                      wrapperStyle={{
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Conversion */}
          <TabsContent value="conversion" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-display">Bookings per day</CardTitle>
              </CardHeader>

              <CardContent className="h-72">
                <ResponsiveContainer>
                  <BarChart data={callTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />

                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />

                    <YAxis tick={{ fontSize: 11 }} />

                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />

                    <Bar dataKey="booked" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Advisor */}
          <TabsContent value="advisor" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-display">Advisor performance</CardTitle>
              </CardHeader>

              <CardContent className="h-72">
                <ResponsiveContainer>
                  <BarChart data={advisorPerf}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />

                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />

                    <YAxis tick={{ fontSize: 11 }} />

                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />

                    <Legend
                      wrapperStyle={{
                        fontSize: 12,
                      }}
                    />

                    <Bar dataKey="booked" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />

                    <Bar dataKey="completed" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Workshop */}
          <TabsContent value="workshop" className="mt-4">
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground text-sm">
                Workshop utilization heatmap by bay and time-of-day.
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
