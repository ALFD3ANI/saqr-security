import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  trend?: { value: number; label: string };
  className?: string;
}

export function StatCard({
  title, value, subtitle, icon: Icon,
  iconColor = "text-primary-400", trend, className,
}: StatCardProps) {
  return (
    <div className={cn(
      "bg-surface-dark border border-slate-800 rounded-2xl p-5 flex flex-col gap-3",
      className
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {subtitle && <p className="text-slate-500 text-xs mt-0.5">{subtitle}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center">
          <Icon size={20} className={iconColor} />
        </div>
      </div>
      {trend && (
        <div className="flex items-center gap-1.5 text-xs">
          <span className={trend.value >= 0 ? "text-emerald-400" : "text-red-400"}>
            {trend.value >= 0 ? "+" : ""}{trend.value}%
          </span>
          <span className="text-slate-500">{trend.label}</span>
        </div>
      )}
    </div>
  );
}
