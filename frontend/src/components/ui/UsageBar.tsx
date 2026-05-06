import { pct, pctColor, formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface UsageBarProps {
  label: string;
  used: number;
  total: number;
  className?: string;
}

export function UsageBar({ label, used, total, className }: UsageBarProps) {
  const p = total === -1 ? 0 : pct(used, total);
  const color = pctColor(p);

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-300">
          {formatNumber(used)} / {total === -1 ? "∞" : formatNumber(total)}
        </span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        {total === -1 ? (
          <div className="h-full w-full bg-emerald-500/30 rounded-full" />
        ) : (
          <div
            className={cn("h-full rounded-full transition-all duration-500", color)}
            style={{ width: `${p}%` }}
          />
        )}
      </div>
    </div>
  );
}
