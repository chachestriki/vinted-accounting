"use client";

import { Info } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  valueColor?: "default" | "success" | "error";
  showChart?: boolean;
  tooltip?: string;
}

const MetricCard = ({
  title,
  value,
  subtitle,
  trend = "neutral",
  valueColor = "default",
  showChart = false,
  tooltip,
}: MetricCardProps) => {
  const getValueColor = () => {
    switch (valueColor) {
      case "success":
        return "text-emerald-500";
      case "error":
        return "text-red-500";
      default:
        return "text-base-content";
    }
  };

  // Mini chart SVG path - simple wave pattern
  const getChartPath = () => {
    if (trend === "up") {
      return "M0,40 Q15,35 30,30 T60,20 T90,15 T120,10 T150,5";
    } else if (trend === "down") {
      return "M0,10 Q15,15 30,20 T60,30 T90,35 T120,38 T150,40";
    }
    return "M0,25 Q30,20 60,25 T120,25 T150,25";
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 relative overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
      {/* Header with title and info icon */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500 font-medium">{title}</span>
        {tooltip && (
          <div className="tooltip tooltip-left" data-tip={tooltip}>
            <Info className="w-4 h-4 text-gray-300 hover:text-gray-400 cursor-help" />
          </div>
        )}
      </div>

      {/* Value */}
      <div className={`text-2xl md:text-3xl font-bold ${getValueColor()}`}>
        {value}
      </div>

      {/* Subtitle */}
      {subtitle && (
        <div className="text-sm text-gray-400 mt-1">{subtitle}</div>
      )}

      {/* Mini chart background */}
      {showChart && (
        <div className="absolute bottom-0 left-0 right-0 h-12 opacity-20">
          <svg
            viewBox="0 0 150 50"
            className="w-full h-full"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id={`gradient-${title.replace(/\s/g, '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop
                  offset="0%"
                  stopColor={
                    valueColor === "success"
                      ? "#10b981"
                      : valueColor === "error"
                      ? "#ef4444"
                      : "#6366f1"
                  }
                  stopOpacity="0.3"
                />
                <stop
                  offset="100%"
                  stopColor={
                    valueColor === "success"
                      ? "#10b981"
                      : valueColor === "error"
                      ? "#ef4444"
                      : "#6366f1"
                  }
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>
            <path
              d={`${getChartPath()} L150,50 L0,50 Z`}
              fill={`url(#gradient-${title.replace(/\s/g, '')})`}
            />
            <path
              d={getChartPath()}
              fill="none"
              stroke={
                valueColor === "success"
                  ? "#10b981"
                  : valueColor === "error"
                  ? "#ef4444"
                  : "#6366f1"
              }
              strokeWidth="2"
            />
          </svg>
        </div>
      )}
    </div>
  );
};

export default MetricCard;

