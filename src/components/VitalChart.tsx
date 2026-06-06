import { useState } from "react";
import { ChevronDown, ChevronUp, Maximize2, X } from "lucide-react";
import { useViewport } from "../lib/useViewport";

type VitalPoint = {
  x: number;
  y?: number;
  label: string;
  series?: string;
};

type Props = {
  title: string;
  unit: string;
  yLabel: string;
  points: VitalPoint[];
  bands?: { label: string; low: number; high: number; color: string }[];
  lines?: { label: string; value: number; color: string }[];
};

type HoverState = {
  sx: number;
  sy: number;
  nearest?: VitalPoint;
};

const width = 900;
const fallbackColors = ["#1d3557", "#00798c", "#8a6f3d"];
const seriesColors: Record<string, string> = {
  Systolic: "#1d5f8a",
  Diastolic: "#7b4ab3",
  Value: "#1d3557",
};

function trim(value: number, digits = 0) {
  const fixed = value.toFixed(digits);
  return fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed;
}

function smoothPath(points: { x: number; y: number }[]) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  const commands = [`M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`];
  for (let index = 0; index < points.length - 1; index++) {
    const p0 = points[Math.max(0, index - 1)];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[Math.min(points.length - 1, index + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 4.5;
    const cp1y = p1.y + (p2.y - p0.y) / 4.5;
    const cp2x = p2.x - (p3.x - p1.x) / 4.5;
    const cp2y = p2.y - (p3.y - p1.y) / 4.5;
    commands.push(`C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`);
  }
  return commands.join(" ");
}

export function VitalChart({ title, unit, yLabel, points, bands = [], lines = [] }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hover, setHover] = useState<HoverState | null>(null);
  const viewport = useViewport();
  const compact = viewport.width < 760 || viewport.height < 720;
  const height = Math.round(
    Math.max(340, Math.min(520, viewport.height * (compact ? 0.5 : 0.46))),
  );
  const expandedHeight = Math.round(Math.max(420, Math.min(760, viewport.height - (compact ? 110 : 130))));
  const finitePoints = points.filter((point) => Number.isFinite(point.y));
  const xMax = Math.max(1, ...finitePoints.map((point) => point.x));
  const yValues = [
    ...finitePoints.map((point) => point.y as number),
    ...bands.flatMap((band) => [band.low, band.high]),
    ...lines.map((line) => line.value),
  ];
  const yMin = Math.max(0, Math.min(...yValues) - Math.max(4, (Math.max(...yValues) - Math.min(...yValues)) * 0.12));
  const yMax = Math.max(...yValues) + Math.max(4, (Math.max(...yValues) - Math.min(...yValues)) * 0.12);
  const yTicks = Array.from({ length: 5 }, (_, index) => yMin + ((yMax - yMin) * index) / 4);
  const series = Array.from(new Set(finitePoints.map((point) => point.series ?? "Value")));

  const renderChart = (chartHeight: number) => {
    const margin = compact
      ? { top: 22, right: 12, bottom: 40, left: 58 }
      : { top: 24, right: 28, bottom: 48, left: 76 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = chartHeight - margin.top - margin.bottom;
    const xScale = (x: number) => margin.left + (x / xMax) * innerWidth;
    const yScale = (y: number) => margin.top + (1 - (y - yMin) / (yMax - yMin)) * innerHeight;
    function handleMove(event: React.MouseEvent<SVGSVGElement>) {
      const rect = event.currentTarget.getBoundingClientRect();
      const sx = ((event.clientX - rect.left) / rect.width) * width;
      const sy = ((event.clientY - rect.top) / rect.height) * chartHeight;
      if (sx < margin.left || sx > margin.left + innerWidth || sy < margin.top || sy > margin.top + innerHeight) {
        setHover(null);
        return;
      }
      const nearest = finitePoints
        .map((point) => ({ point, distance: Math.hypot(xScale(point.x) - sx, yScale(point.y as number) - sy) }))
        .sort((a, b) => a.distance - b.distance)[0];
      setHover({ sx, sy, nearest: nearest?.distance <= 28 ? nearest.point : undefined });
    }

    return (
      <svg className="growth-svg" viewBox={`0 0 ${width} ${chartHeight}`} onMouseMove={handleMove} onMouseLeave={() => setHover(null)} role="img" aria-label={title}>
        <rect x="0" y="0" width={width} height={chartHeight} fill="#ffffff" />
        {bands.map((band) => (
          <g key={band.label}>
            <rect x={margin.left} y={yScale(band.high)} width={innerWidth} height={Math.max(0, yScale(band.low) - yScale(band.high))} fill={band.color} opacity="0.16" />
            <line x1={margin.left} x2={margin.left + innerWidth} y1={yScale(band.high)} y2={yScale(band.high)} stroke={band.color} strokeDasharray="6 4" />
            <line x1={margin.left} x2={margin.left + innerWidth} y1={yScale(band.low)} y2={yScale(band.low)} stroke={band.color} strokeDasharray="6 4" />
            <text x={margin.left + innerWidth - 8} y={yScale(band.high) - 6} textAnchor="end" className="axis-tick">{band.label} high {trim(band.high)}</text>
            <text x={margin.left + innerWidth - 8} y={yScale(band.low) + 14} textAnchor="end" className="axis-tick">{band.label} low {trim(band.low)}</text>
          </g>
        ))}
        {yTicks.map((tick) => (
          <g key={tick}>
            <line x1={margin.left} x2={margin.left + innerWidth} y1={yScale(tick)} y2={yScale(tick)} stroke="#d8dee6" strokeDasharray="3 3" />
            <text x={margin.left - 12} y={yScale(tick) + 4} textAnchor="end" className="axis-tick">{trim(tick)}</text>
          </g>
        ))}
        {lines.map((line) => (
          <g key={line.label}>
            <line x1={margin.left} x2={margin.left + innerWidth} y1={yScale(line.value)} y2={yScale(line.value)} stroke={line.color} strokeDasharray="6 4" />
            <text x={margin.left + 8} y={yScale(line.value) - 6} className="axis-tick" style={{ fill: line.color }}>{line.label}</text>
          </g>
        ))}
        <line x1={margin.left} x2={margin.left + innerWidth} y1={margin.top + innerHeight} y2={margin.top + innerHeight} stroke="#9aa9b7" />
        <line x1={margin.left} x2={margin.left} y1={margin.top} y2={margin.top + innerHeight} stroke="#9aa9b7" />
        <text x={margin.left + innerWidth / 2} y={chartHeight - 8} textAnchor="middle" className="axis-label">Visit sequence</text>
        <text x={compact ? "14" : "20"} y={margin.top + innerHeight / 2} textAnchor="middle" className="axis-label" transform={`rotate(-90 ${compact ? 14 : 20} ${margin.top + innerHeight / 2})`}>{yLabel}</text>
        {series.map((name, index) => {
          const items = finitePoints.filter((point) => (point.series ?? "Value") === name);
          const color = seriesColors[name] ?? fallbackColors[index % fallbackColors.length];
          const path = smoothPath(items.map((point) => ({ x: xScale(point.x), y: yScale(point.y as number) })));
          return (
            <g key={name}>
              <path d={path} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              {items.map((point) => (
                <g key={`${name}-${point.label}-${point.y}`}>
                  <circle cx={xScale(point.x)} cy={yScale(point.y as number)} r="5" fill={color} stroke="#ffffff" strokeWidth="2" />
                  <title>{`${point.label}: ${trim(point.y as number, 1)} ${unit}`}</title>
                </g>
              ))}
              <line x1={margin.left + index * 120} x2={margin.left + 24 + index * 120} y1={14} y2={14} stroke={color} strokeWidth="2.4" />
              <text x={margin.left + 31 + index * 120} y={18} className="axis-tick">{name}</text>
            </g>
          );
        })}
        {hover?.nearest &&
          (() => {
            const item = hover.nearest;
            const color = seriesColors[item.series ?? "Value"] ?? fallbackColors[0];
            const boxWidth = 236;
            const boxHeight = 88;
            const tx = hover.sx > width - boxWidth - 18 ? hover.sx - boxWidth - 12 : hover.sx + 12;
            const ty = Math.max(margin.top + 4, Math.min(hover.sy - 48, chartHeight - boxHeight - 8));
            return (
              <g>
                <line x1={xScale(item.x)} x2={xScale(item.x)} y1={margin.top} y2={margin.top + innerHeight} stroke="#6d8791" strokeDasharray="4 4" />
                <circle cx={xScale(item.x)} cy={yScale(item.y as number)} r="6" fill={color} stroke="#ffffff" strokeWidth="2.4" />
                <g transform={`translate(${tx}, ${ty})`}>
                  <rect width={boxWidth} height={boxHeight} rx="12" fill="var(--surface)" stroke="var(--line-strong)" />
                  <rect x="1" y="1" width={boxWidth - 2} height="34" rx="11" fill="var(--surface-muted)" />
                  <text x="14" y="22" className="tooltip-title">{item.series ?? title}</text>
                  <text x="14" y="54" className="tooltip-muted">{item.label}</text>
                  <text x="14" y="75" className="tooltip-title" fill={color}>{trim(item.y as number, 1)} {unit}</text>
                </g>
              </g>
            );
          })()}
      </svg>
    );
  };

  return (
    <>
    <section className={`chart-panel ${isCollapsed ? "is-collapsed" : ""}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          <p>{finitePoints.length} recorded visit{finitePoints.length === 1 ? "" : "s"}</p>
        </div>
        <div className="chart-actions">
          <button className="icon-button" onClick={() => setIsCollapsed((value) => !value)} title={isCollapsed ? "Show graph" : "Hide graph"} aria-label={isCollapsed ? `Show ${title}` : `Hide ${title}`}>
            {isCollapsed ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
          </button>
          <button className="icon-button" onClick={() => setIsExpanded(true)} title="Enlarge graph" aria-label={`Enlarge ${title}`}>
            <Maximize2 size={17} />
          </button>
        </div>
      </div>
      {!isCollapsed && <div className="chart-wrap vital-chart-wrap" style={{ height }}>{renderChart(height)}</div>}
    </section>
    {isExpanded && (
      <div className="chart-modal" role="dialog" aria-modal="true" aria-label={`${title} enlarged`}>
        <div className="chart-modal-panel">
          <div className="panel-heading">
            <div>
              <h2>{title}</h2>
              <p>{finitePoints.length} recorded visit{finitePoints.length === 1 ? "" : "s"}</p>
            </div>
            <button className="icon-button" onClick={() => setIsExpanded(false)} title="Close enlarged graph" aria-label="Close enlarged graph">
              <X size={18} />
            </button>
          </div>
          <div className="chart-modal-wrap" style={{ height: expandedHeight }}>{renderChart(expandedHeight)}</div>
        </div>
      </div>
    )}
    </>
  );
}
