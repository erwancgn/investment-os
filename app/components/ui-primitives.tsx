"use client";

import { createContext, useContext, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";

type ProgressTone = "accent" | "positive" | "neutral" | "warning";
type SurfaceTag = "div" | "article" | "section" | "aside" | "header" | "nav" | "details" | "button" | "label" | "span";
type SurfaceRole = "primary" | "secondary" | "glass";
export type BadgeTone = "neutral" | "accent" | "positive" | "warning" | "negative";
type DiscoveryCardKind = "company" | "analysis" | "watchlist";

type SurfaceProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  className?: string;
  as?: SurfaceTag;
  surface: SurfaceRole;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
};

const SurfaceContext = createContext<SurfaceRole | null>(null);

/**
 * Semantic surface primitive inspired by Apple's grouped backgrounds and
 * Liquid Glass material hierarchy. A primary surface nested in another
 * content surface resolves to secondary automatically, so components cannot
 * accidentally create a white card inside a white card.
 */
export function Surface({ children, className = "", as: Tag = "div", surface, type, ...props }: SurfaceProps) {
  const parentSurface = useContext(SurfaceContext);
  const resolvedSurface = surface === "primary" && (parentSurface === "primary" || parentSurface === "secondary")
    ? "secondary"
    : surface;
  return (
    <SurfaceContext.Provider value={resolvedSurface}>
      <Tag
        {...props}
        type={Tag === "button" ? type ?? "button" : type}
        className={`ui-surface ui-surface--${resolvedSurface} ${className}`.trim()}
        data-surface={resolvedSurface}
      >
        {children}
      </Tag>
    </SurfaceContext.Provider>
  );
}

export function ProgressBar({
  value,
  max = 100,
  tone = "accent",
  className = "",
  label,
}: {
  value: number | null | undefined;
  max?: number;
  tone?: ProgressTone;
  className?: string;
  label?: string;
}) {
  const safeMax = Math.max(0, max);
  const percent = safeMax > 0 ? Math.min(100, Math.max(0, ((value ?? 0) / safeMax) * 100)) : 0;
  const style = { "--progress": `${percent}%` } as CSSProperties;
  return (
    <span
      className={`ui-progress-track ui-progress-track--${tone} ${className}`.trim()}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={value == null ? 0 : Math.max(0, Math.min(safeMax, value))}
    >
      <span className="ui-progress-fill" style={style} />
    </span>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  contained = false,
  className = "",
}: {
  options: Array<{ value: T; label: ReactNode }>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  contained?: boolean;
  className?: string;
}) {
  return (
    <div className={`ui-control-group${contained ? " ui-control-group--contained" : ""} ${className}`.trim()} role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          className={`ui-control ${value === option.value ? "is-active" : ""}`.trim()}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          <span className="ui-control-visual">{option.label}</span>
        </button>
      ))}
    </div>
  );
}


type CompactControlSelectProps = {
  variant: "select";
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  ariaLabel: string;
  id?: string;
  className?: string;
};

type CompactControlIconProps = {
  variant: "icon";
  children: ReactNode;
  onClick: () => void;
  ariaLabel: string;
  title?: string;
  disabled?: boolean;
  className?: string;
};

export function CompactControl(props: CompactControlSelectProps | CompactControlIconProps) {
  if (props.variant === "select") {
    const { value, options, onChange, ariaLabel, id, className = "" } = props;
    const selectedLabel = options.find((option) => option.value === value)?.label ?? value;
    return (
      <span className={`ui-compact-control ui-compact-control--select ${className}`.trim()}>
        <span className="ui-compact-control-sizer" aria-hidden="true">{selectedLabel}</span>
        <span className="ui-compact-control-visual" aria-hidden="true" />
        <select id={id} value={value} aria-label={ariaLabel} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <svg className="ui-compact-control-chevron" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
          <path d="m3 4.5 3 3 3-3" />
        </svg>
      </span>
    );
  }

  const { children, onClick, ariaLabel, title, disabled = false, className = "" } = props;
  return (
    <button
      type="button"
      className={`ui-compact-control ui-compact-control--icon ${className}`.trim()}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="ui-compact-control-visual">{children}</span>
    </button>
  );
}

export function ActionButton({
  children,
  onClick,
  className = "",
  compact = false,
  ariaLabel,
}: {
  children: ReactNode;
  onClick: () => void;
  className?: string;
  compact?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      className={`ui-action-button${compact ? " ui-action-button--compact" : ""} ${className}`.trim()}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      <span>{children}</span>
      <b aria-hidden="true">→</b>
    </button>
  );
}

export function DiscoveryAction({
  children,
  onClick,
  ariaLabel,
  className = "",
}: {
  children: ReactNode;
  onClick: () => void;
  ariaLabel: string;
  className?: string;
}) {
  return <button type="button" className={`ui-discovery-action ${className}`.trim()} aria-label={ariaLabel} onClick={onClick}><span className="ui-discovery-action-visual">{children}</span></button>;
}

export function BackButton({
  onBack,
  ariaLabel = "Retour",
  className = "",
}: {
  onBack: () => void;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`ui-back-button ${className}`.trim()}
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={onBack}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="m14.5 5-7 7 7 7" />
      </svg>
    </button>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className = "",
  title,
  ariaLabel,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
  title?: string;
  ariaLabel?: string;
}) {
  return <span className={`ui-badge ui-badge--${tone} ${className}`.trim()} title={title} aria-label={ariaLabel}>{children}</span>;
}

export function SearchField({
  value,
  onChange,
  placeholder,
  ariaLabel,
  count,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  count?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`ui-search-toolbar ${className}`.trim()}>
      <Surface as="label" surface="primary" className="ui-search-field">
        <span aria-hidden="true">⌕</span>
        <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={ariaLabel} />
      </Surface>
      {count != null && <span className="ui-search-count">{count}</span>}
    </div>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  heading = "h2",
  description,
  meta,
  actions,
  className = "",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  heading?: "h1" | "h2";
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`ui-section-header ${className}`.trim()}>
      <div className="ui-section-header-copy">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        {heading === "h1" ? <h1>{title}</h1> : <h2>{title}</h2>}
        {description && <p>{description}</p>}
      </div>
      {(meta || actions) && <div className="ui-section-header-actions">{meta}{actions}</div>}
    </header>
  );
}

export function FilterBar({ children, ariaLabel, className = "" }: { children: ReactNode; ariaLabel?: string; className?: string }) {
  return <div className={`ui-filter-bar ${className}`.trim()} role={ariaLabel ? "group" : undefined} aria-label={ariaLabel}>{children}</div>;
}

export function Tabs<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = "",
}: {
  options: Array<{ value: T; label: ReactNode; count?: ReactNode }>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div className={`ui-tabs ${className}`.trim()} role="tablist" aria-label={ariaLabel} onKeyDown={event => {
      const index = options.findIndex(option => option.value === value);
      const next = event.key === "ArrowRight" ? (index + 1) % options.length : event.key === "ArrowLeft" ? (index + options.length - 1) % options.length : event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : -1;
      if (next < 0 || !options.length) return;
      event.preventDefault();
      onChange(options[next].value);
      const button = event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=tab]")[next];
      button?.focus({ preventScroll: true });
      button?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }}>
      {options.map((option) => {
        const selected = option.value === value;
        return <button type="button" role="tab" aria-selected={selected} tabIndex={selected ? 0 : -1} className={selected ? "is-active" : ""} key={option.value} onClick={() => onChange(option.value)}>{option.label}{option.count != null && <span>{option.count}</span>}</button>;
      })}
    </div>
  );
}

export function StatCard({
  label,
  value,
  detail,
  className = "",
}: {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  className?: string;
}) {
  return <PrimaryBlock as="article" className={`ui-stat-card ${className}`.trim()}><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</PrimaryBlock>;
}

export function DiscoveryCard({
  kind,
  children,
  className = "",
  as: Tag = "article",
  ...props
}: SurfaceWrapperProps & { kind: DiscoveryCardKind }) {
  return <PrimaryBlock {...props} as={Tag} className={`ui-discovery-card ui-discovery-card--${kind} ${className}`.trim()}>{children}</PrimaryBlock>;
}

export function AsyncState({
  title,
  description,
  action,
  className = "",
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return <PrimaryBlock as="section" className={`ui-async-state ${className}`.trim()}><strong>{title}</strong>{description && <span>{description}</span>}{action}</PrimaryBlock>;
}

type SurfaceWrapperProps = Omit<SurfaceProps, "surface">;

export function PrimaryBlock({ children, className = "", as: Tag = "div", ...props }: SurfaceWrapperProps) {
  return <Surface {...props} as={Tag} surface="primary" className={className}>{children}</Surface>;
}

export function SecondaryBlock({ children, className = "", as: Tag = "div", ...props }: SurfaceWrapperProps) {
  return <Surface {...props} as={Tag} surface="secondary" className={className}>{children}</Surface>;
}

export function GlassChrome({ children, className = "", as: Tag = "div", ...props }: SurfaceWrapperProps) {
  return <Surface {...props} as={Tag} surface="glass" className={className}>{children}</Surface>;
}

export function DisclosureSurface({
  summary,
  children,
  className = "",
  summaryClassName = "",
  level = "secondary",
}: {
  summary: ReactNode;
  children: ReactNode;
  className?: string;
  summaryClassName?: string;
  level?: "primary" | "secondary";
}) {
  return (
    <Surface as="details" surface={level} className={`ui-disclosure-surface ${className}`.trim()}>
      <summary className={summaryClassName}>{summary}</summary>
      <div className="ui-disclosure-body">{children}</div>
    </Surface>
  );
}

export type MetadataItem = { label: string; value: ReactNode; description?: ReactNode; className?: string };

export function MetadataGrid({
  items,
  className = "",
  ariaLabel,
}: {
  items: MetadataItem[];
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <dl className={`ui-metadata-grid ${className}`.trim()} aria-label={ariaLabel}>
      {items.map((item) => (
        <SecondaryBlock className={`ui-metadata-item ${item.className ?? ""}`.trim()} key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
          {item.description != null && <small>{item.description}</small>}
        </SecondaryBlock>
      ))}
    </dl>
  );
}

export type DataTableColumn<Row> = {
  key: string;
  label: string;
  className?: string;
  render: (row: Row) => ReactNode;
};

export function DataTable<Row>({
  columns,
  rows,
  getRowKey,
  ariaLabel,
  className = "",
}: {
  columns: Array<DataTableColumn<Row>>;
  rows: Row[];
  getRowKey: (row: Row) => string;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <PrimaryBlock className={`ui-data-table-wrap ${className}`.trim()}>
      <table className="ui-data-table" aria-label={ariaLabel}>
        <thead>
          <tr>{columns.map((column) => <th key={column.key} className={column.className}>{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowKey(row)}>
              {columns.map((column) => <td key={column.key} className={column.className} data-label={column.label}>{column.render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </PrimaryBlock>
  );
}
