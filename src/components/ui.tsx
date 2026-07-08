import { useState, type ReactNode } from "react";
import { cn } from "../utils/cn";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</span>
      {children}
    </label>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</span>
        <span className="text-[10px] font-mono text-slate-300">{format ? format(value) : value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-4 w-full accent-violet-500"
      />
    </div>
  );
}

export function NumberInput({
  value,
  onChange,
  step = 1,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  className?: string;
}) {
  return (
    <input
      type="number"
      step={step}
      value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className={cn(
        "w-full rounded-md border border-slate-700 bg-slate-800/60 px-1.5 py-1 text-xs text-slate-100 outline-none focus:border-violet-500",
        className
      )}
    />
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "w-full rounded-md border border-slate-700 bg-slate-800/60 px-1.5 py-1 text-xs text-slate-100 outline-none focus:border-violet-500",
        className
      )}
    />
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="w-full rounded-md border border-slate-700 bg-slate-800/60 px-1.5 py-1 text-xs text-slate-100 outline-none focus:border-violet-500"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-md border border-slate-700 bg-slate-800/40 px-2 py-1.5 text-xs text-slate-200 hover:border-slate-600"
    >
      <span>{label}</span>
      <span
        className={cn(
          "relative h-4 w-8 shrink-0 rounded-full transition",
          checked ? "bg-violet-500" : "bg-slate-600"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-3 w-3 rounded-full bg-white transition",
            checked ? "left-4.5" : "left-0.5"
          )}
          style={{ left: checked ? "1.125rem" : "0.125rem" }}
        />
      </span>
    </button>
  );
}

export function Btn({
  children,
  onClick,
  variant = "default",
  className,
  title,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "ghost" | "danger";
  className?: string;
  title?: string;
  disabled?: boolean;
}) {
  const styles = {
    default: "border border-slate-700 bg-slate-800/60 text-slate-200 hover:bg-slate-700/60",
    primary: "bg-gradient-to-br from-violet-500 to-indigo-600 text-white hover:from-violet-400 hover:to-indigo-500 shadow-lg shadow-indigo-900/40",
    ghost: "text-slate-300 hover:bg-slate-800/60",
    danger: "border border-rose-800/60 bg-rose-950/40 text-rose-300 hover:bg-rose-900/50",
  };
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-md px-2.5 py-1 text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed",
        styles[variant],
        className
      )}
    >
      {children}
    </button>
  );
}

export function Panel({ title, children, action, defaultCollapsed = false }: { title: string; children: ReactNode; action?: ReactNode; defaultCollapsed?: boolean }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  return (
    <div className="mb-2 rounded-lg border border-slate-800 bg-slate-900/40">
      <div className="flex items-center justify-between border-b border-slate-800 px-2.5 py-1.5 cursor-pointer hover:bg-slate-800/40" onClick={() => setCollapsed(!collapsed)}>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-slate-500">{collapsed ? "▶" : "▼"}</span>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-300">{title}</h3>
        </div>
        <div onClick={(e) => e.stopPropagation()}>{action}</div>
      </div>
      {!collapsed && <div className="space-y-2 p-2.5">{children}</div>}
    </div>
  );
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return <p className="px-1 py-4 text-center text-[11px] text-slate-500">{children}</p>;
}
