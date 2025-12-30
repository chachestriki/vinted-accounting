"use client";

type DateRange =
  | "today"
  | "last7days"
  | "last14days"
  | "thisMonth"
  | "perMonth"
  | "last3months"
  | "thisYear"
  | "allTime"
  | "custom";

interface DateFilterProps {
  selectedRange: DateRange;
  onRangeChange: (range: DateRange) => void;
}

const dateRanges: { value: DateRange; label: string }[] = [
  { value: "today", label: "Hoy" },
  { value: "last7days", label: "Últimos 7 Días" },
  { value: "last14days", label: "Últimos 14 Días" },
  { value: "thisMonth", label: "Este Mes" },
  { value: "last3months", label: "Últimos 3 Meses" },
  { value: "thisYear", label: "Este Año" },
  { value: "allTime", label: "Todo" },
  { value: "custom", label: "Personalizado" }
];

const DateFilter = ({ selectedRange, onRangeChange }: DateFilterProps) => {
  return (
    <div className="flex flex-wrap gap-2">
      {dateRanges.map((range) => (
        <button
          key={range.value}
          onClick={() => onRangeChange(range.value)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${selectedRange === range.value
              ? "bg-gray-900 text-white"
              : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
};

export default DateFilter;
export type { DateRange };

