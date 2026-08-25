"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
type Datum = { name: string; value: number };

const CYCLE_COLORS = [
  "#4a9e6b",
  "#2980b9",
  "#d4a017",
  "#d35400",
  "#c0392b",
  "#16a085",
  "#8e44ad",
  "#2c3e50",
  "#7f8c8d",
  "#e67e22",
];

export function CategoryBarChart({ data }: { data: Datum[] }) {
  const needsRotation = data.length > 4;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, left: -16, bottom: needsRotation ? 40 : 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11 }}
          interval={0}
          angle={needsRotation ? -45 : 0}
          textAnchor={needsRotation ? "end" : "middle"}
          height={needsRotation ? 60 : 30}
          className="text-muted"
        />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} className="text-muted" />
        <Tooltip
          cursor={{ fill: "rgba(0,0,0,0.04)" }}
          contentStyle={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            color: "var(--foreground)",
          }}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={d.name} fill={CYCLE_COLORS[i % CYCLE_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CropPieChart({ data }: { data: Datum[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          label={({ name, value }) => `${name} (${value})`}
        >
          {data.map((d, i) => (
            <Cell key={d.name} fill={CYCLE_COLORS[i % CYCLE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            color: "var(--foreground)",
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
