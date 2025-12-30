"use client";

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";

interface ChartDataPoint {
    date: string;
    value: number;
}

interface SalesChartProps {
    data: ChartDataPoint[];
    title: string;
    valueLabel: string;
    color?: string;
    formatValue?: (value: number) => string;
}

const SalesChart = ({
    data,
    title,
    valueLabel,
    color = "#3b82f6",
    formatValue = (value) => value.toString(),
}: SalesChartProps) => {
    return (
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                        dataKey="date"
                        stroke="#9ca3af"
                        style={{ fontSize: "12px" }}
                        tickMargin={10}
                    />
                    <YAxis
                        stroke="#9ca3af"
                        style={{ fontSize: "12px" }}
                        tickFormatter={formatValue}
                        tickMargin={10}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: "white",
                            border: "1px solid #e5e7eb",
                            borderRadius: "8px",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                        }}
                        formatter={(value: number) => [formatValue(value), valueLabel]}
                        labelStyle={{ color: "#374151", fontWeight: 600 }}
                    />
                    <Legend
                        wrapperStyle={{ paddingTop: "20px" }}
                        iconType="line"
                    />
                    <Line
                        type="monotone"
                        dataKey="value"
                        stroke={color}
                        strokeWidth={2}
                        dot={{ fill: color, r: 4 }}
                        activeDot={{ r: 6 }}
                        name={valueLabel}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

export default SalesChart;
