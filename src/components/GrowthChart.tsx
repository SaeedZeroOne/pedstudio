import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Maximize2, X } from "lucide-react";
import { curve, type MetricKey, type ReferenceName, type Sex } from "../lib/growth";
import { useViewport } from "../lib/useViewport";

type Props = {
  metric: MetricKey;
  title: string;
  sex: Sex;
  reference: ReferenceName;
  points: { x: number; y: number; label: string }[];
  unit: string;
  yLabel: string;
};

type CurveRow = { x: number } & Record<string, number | undefined>;
type HoverState = {
  sx: number;
  sy: number;
  x: number;
  values: Record<string, number | undefined>;
  patient?: { label: string; value: number };
};

const colors = {
  "3rd": "#d1495b",
  "10th": "#edae49",
  "50th": "#00798c",
  "90th": "#edae49",
  "97th": "#d1495b",
};

const percentileKeys = Object.keys(colors);
const chartWidth = 900;

function smoothPath(points: { x: number; y: number }[]) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  const commands = [`M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`];
  for (let index = 0; index < points.length - 1; index++) {
    const p0 = points[Math.max(0, index - 1)];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[Math.min(points.length - 1, index + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    commands.push(`C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`);
  }
  return commands.join(" ");
}

export function GrowthChart({ metric, title, sex, reference, points, unit, yLabel }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hover, setHover] = useState<HoverState | null>(null);
  const viewport = useViewport();
  const compact = viewport.width < 760 || viewport.height < 720;
  const data = curve(metric, sex, reference) as CurveRow[];
  const xLabel = reference === "Olsen preterm" ? "Completed gestational age (weeks)" : reference === "CDC 2-20 years" ? "Age (years)" : "Age (months)";
  const xDomain: [number, number] = reference === "Olsen preterm" ? [23, 36] : reference === "CDC 2-20 years" ? [24, 240] : reference === "WHO 0-5 years" ? [0, 60] : [0, 24];
  const xTicks = reference === "Olsen preterm"
    ? compact ? [23, 26, 29, 32, 35] : [23, 24, 26, 28, 30, 32, 34, 36]
    : reference === "CDC 2-20 years"
      ? compact ? [24, 72, 120, 168, 216, 240] : Array.from({ length: 10 }, (_, i) => (i + 2) * 24)
      : reference === "WHO 0-5 years"
        ? compact ? [0, 12, 24, 36, 48, 60] : [0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60]
      : compact ? [0, 6, 12, 18, 24] : [0, 3, 6, 9, 12, 15, 18, 21, 24];
  const inlineHeight = Math.round(
    Math.max(430, Math.min(680, viewport.height * (compact ? 0.62 : 0.58))),
  );
  const expandedHeight = Math.round(Math.max(420, Math.min(760, viewport.height - (compact ? 110 : 130))));

  const trimNumber = (value: number, digits: number) => {
    const fixed = value.toFixed(digits);
    return fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed;
  };
  const formatX = (value: number) => {
    if (!Number.isFinite(value)) return "";
    return reference === "CDC 2-20 years" ? trimNumber(value / 12, 1) : trimNumber(value, 1);
  };
  const formatY = (value: number) => {
    if (!Number.isFinite(value)) return "";
    if (metric === "bmi") return trimNumber(value, 1);
    if (metric === "weight" && value < 10) return trimNumber(value, 1);
    return trimNumber(value, 0);
  };
  const yDigits = metric === "bmi" || metric === "weight" ? 1 : 0;

  const yDomain = useMemo<[number, number]>(() => {
    const values = [
      ...data.flatMap((row) => percentileKeys.map((key) => row[key]).filter((value): value is number => Number.isFinite(value))),
      ...points.map((point) => point.y).filter(Number.isFinite),
    ];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = Math.max((max - min) * 0.08, metric === "weight" ? 0.5 : 1);
    return [Math.max(0, min - pad), max + pad];
  }, [data, points, metric]);

  const interpolate = (key: string, x: number) => {
    const leftIndex = data.findIndex((row, index) => row.x <= x && (data[index + 1]?.x ?? Infinity) >= x);
    const left = data[Math.max(0, leftIndex)];
    const right = data[Math.min(data.length - 1, Math.max(0, leftIndex) + 1)];
    if (!left || !right) return undefined;
    const a = left[key];
    const b = right[key];
    if (!Number.isFinite(a) || !Number.isFinite(b)) return undefined;
    if (left.x === right.x) return a;
    return (a as number) + (((b as number) - (a as number)) * (x - left.x)) / (right.x - left.x);
  };

  const renderChart = (chartHeight: number) => {
    const margin = compact
      ? { top: 22, right: 14, bottom: 42, left: 58 }
      : { top: 26, right: 28, bottom: 50, left: 76 };
    const innerWidth = chartWidth - margin.left - margin.right;
    const innerHeight = chartHeight - margin.top - margin.bottom;
    const xScale = (x: number) => margin.left + ((x - xDomain[0]) / (xDomain[1] - xDomain[0])) * innerWidth;
    const yScale = (y: number) => margin.top + (1 - (y - yDomain[0]) / (yDomain[1] - yDomain[0])) * innerHeight;
    const pathFor = (key: string) =>
      smoothPath(
        data
          .filter((row) => Number.isFinite(row[key]))
          .map((row) => ({ x: xScale(row.x), y: yScale(row[key] as number) })),
      );
    const yTicks = Array.from({ length: 6 }, (_, index) => yDomain[0] + ((yDomain[1] - yDomain[0]) * index) / 5);

    function handleMove(event: React.MouseEvent<SVGSVGElement>) {
      const rect = event.currentTarget.getBoundingClientRect();
      const sx = ((event.clientX - rect.left) / rect.width) * chartWidth;
      const sy = ((event.clientY - rect.top) / rect.height) * chartHeight;
      if (sx < margin.left || sx > margin.left + innerWidth || sy < margin.top || sy > margin.top + innerHeight) {
        setHover(null);
        return;
      }
      const x = xDomain[0] + ((sx - margin.left) / innerWidth) * (xDomain[1] - xDomain[0]);
      const patient = points
        .map((point) => ({
          point,
          distance: Math.hypot(xScale(point.x) - sx, yScale(point.y) - sy),
        }))
        .filter((item) => item.distance <= 12)
        .sort((a, b) => a.distance - b.distance)[0]?.point;
      setHover({
        sx,
        sy,
        x,
        values: Object.fromEntries(percentileKeys.map((key) => [key, interpolate(key, x)])),
        patient: patient ? { label: patient.label, value: patient.y } : undefined,
      });
    }

    return (
      <svg className="growth-svg" viewBox={`0 0 ${chartWidth} ${chartHeight}`} onMouseMove={handleMove} onMouseLeave={() => setHover(null)} role="img" aria-label={title}>
        <rect x="0" y="0" width={chartWidth} height={chartHeight} fill="#ffffff" />
        {yTicks.map((tick) => (
          <g key={tick}>
            <line x1={margin.left} x2={margin.left + innerWidth} y1={yScale(tick)} y2={yScale(tick)} stroke="#d8dee6" strokeDasharray="3 3" />
            <text x={margin.left - 10} y={yScale(tick) + 4} textAnchor="end" className="axis-tick">{formatY(tick)}</text>
          </g>
        ))}
        {xTicks.map((tick) => (
          <g key={tick}>
            <line x1={xScale(tick)} x2={xScale(tick)} y1={margin.top} y2={margin.top + innerHeight} stroke="#edf1f4" />
            <text x={xScale(tick)} y={margin.top + innerHeight + 22} textAnchor="middle" className="axis-tick">{formatX(tick)}</text>
          </g>
        ))}
        <line x1={margin.left} x2={margin.left + innerWidth} y1={margin.top + innerHeight} y2={margin.top + innerHeight} stroke="#9aa9b7" />
        <line x1={margin.left} x2={margin.left} y1={margin.top} y2={margin.top + innerHeight} stroke="#9aa9b7" />
        <text x={margin.left + innerWidth / 2} y={chartHeight - 8} textAnchor="middle" className="axis-label">{xLabel}</text>
        <text x={compact ? "14" : "20"} y={margin.top + innerHeight / 2} textAnchor="middle" className="axis-label" transform={`rotate(-90 ${compact ? 14 : 20} ${margin.top + innerHeight / 2})`}>{yLabel}</text>

        {percentileKeys.map((key) => (
          <path key={key} d={pathFor(key)} fill="none" stroke={colors[key as keyof typeof colors]} strokeWidth={key === "50th" ? 2.7 : 1.6} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {percentileKeys.map((key, index) => (
          <g key={`${key}-legend`}>
            <line x1={margin.left + index * 86} x2={margin.left + 24 + index * 86} y1={14} y2={14} stroke={colors[key as keyof typeof colors]} strokeWidth={key === "50th" ? 2.7 : 1.6} />
            <text x={margin.left + 31 + index * 86} y={18} className="axis-tick">{key}</text>
          </g>
        ))}
        {points.map((point) => (
          <circle key={`${point.label}-${point.x}-${point.y}`} cx={xScale(point.x)} cy={yScale(point.y)} r="5.5" fill="#1d3557" stroke="#ffffff" strokeWidth="2" />
        ))}
        {hover &&
          (() => {
            const rows = [
              ...percentileKeys.map((key) => ({
                key,
                label: key,
                value: hover.values[key],
                color: colors[key as keyof typeof colors],
              })),
              ...(hover.patient ? [{ key: "patient", label: `Patient (${hover.patient.label})`, value: hover.patient.value, color: "#1d3557" }] : []),
            ].sort((a, b) => {
              if (a.value === undefined) return 1;
              if (b.value === undefined) return -1;
              return b.value - a.value;
            });
            const boxHeight = 32 + rows.length * 20;
            const boxWidth = 252;
            const tx = hover.sx > chartWidth - boxWidth - 18 ? hover.sx - boxWidth - 12 : hover.sx + 12;
            const ty = Math.max(margin.top + 4, Math.min(hover.sy - 48, chartHeight - boxHeight - 8));
            return (
              <g>
                <line x1={hover.sx} x2={hover.sx} y1={margin.top} y2={margin.top + innerHeight} stroke="#647789" strokeDasharray="4 4" />
                <circle cx={hover.sx} cy={hover.sy} r="4" fill="#1d3557" stroke="#ffffff" strokeWidth="2" />
                <g transform={`translate(${tx}, ${ty})`}>
                  <rect width={boxWidth} height={boxHeight} rx="10" fill="#ffffff" stroke="#cfd9e2" />
                  <rect width={boxWidth} height="30" rx="10" fill="#f5f9fd" />
                  <line x1="0" x2={boxWidth} y1="30" y2="30" stroke="#e5edf3" />
                  <text x="12" y="20" className="tooltip-title">{xLabel}</text>
                  <text x={boxWidth - 12} y="20" textAnchor="end" className="tooltip-title">{formatX(hover.x)}</text>
                  {rows.map((row, index) => (
                    <g key={row.key} transform={`translate(12, ${43 + index * 20})`}>
                      <circle cx="3" cy="-4" r="3" fill={row.color} />
                      <text x="13" y="0" className={row.key === "patient" ? "tooltip-title" : "tooltip-line"} fill={row.color}>{row.label}</text>
                      <text x={boxWidth - 24} y="0" textAnchor="end" className={row.key === "patient" ? "tooltip-title" : "tooltip-line"} fill={row.color}>
                        {row.value === undefined ? "-" : `${trimNumber(row.value, yDigits)} ${unit}`}
                      </text>
                    </g>
                  ))}
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
            <p>{reference}</p>
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
        {!isCollapsed && <div className="chart-wrap" style={{ height: inlineHeight }}>{renderChart(inlineHeight)}</div>}
      </section>
      {isExpanded && (
        <div className="chart-modal" role="dialog" aria-modal="true" aria-label={`${title} enlarged`}>
          <div className="chart-modal-panel">
            <div className="panel-heading">
              <div>
                <h2>{title}</h2>
                <p>{reference}</p>
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
