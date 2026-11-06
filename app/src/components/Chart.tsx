"use client";
// Generiek ECharts-component: responsive, tooltips, zoom, doorklikken,
// export naar PNG/PDF en een tabelweergave (toegankelijkheid).
import { useEffect, useRef, useState } from "react";
import type { EChartsOption, ECharts } from "echarts";

export type ChartTable = { columns: string[]; rows: (string | number | null)[][] };

export function Chart({
  option, height = 320, onClick, title, table, ariaLabel, filename = "grafiek",
}: {
  option: EChartsOption;
  height?: number;
  onClick?: (p: { name?: string; data?: unknown; seriesName?: string; dataIndex?: number; value?: unknown }) => void;
  title?: string;
  table?: ChartTable;
  ariaLabel?: string;
  filename?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<ECharts | null>(null);
  const [showTable, setShowTable] = useState(false);
  const clickRef = useRef(onClick);
  clickRef.current = onClick;

  useEffect(() => {
    let disposed = false;
    let ro: ResizeObserver | null = null;
    import("echarts").then((echarts) => {
      if (disposed || !ref.current) return;
      chart.current = echarts.init(ref.current, undefined, { renderer: "canvas" });
      chart.current.on("click", (p) => clickRef.current?.(p as never));
      ro = new ResizeObserver(() => chart.current?.resize());
      ro.observe(ref.current);
      chart.current.setOption(withDefaults(option), true);
    });
    return () => {
      disposed = true;
      ro?.disconnect();
      chart.current?.dispose();
      chart.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    chart.current?.setOption(withDefaults(option), true);
  }, [option]);

  const png = () => {
    const url = chart.current?.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#fff" });
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.png`;
    a.click();
  };
  const pdf = async () => {
    const url = chart.current?.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#fff" });
    if (!url || !ref.current) return;
    const { jsPDF } = await import("jspdf");
    const w = ref.current.clientWidth, h = ref.current.clientHeight;
    const doc = new jsPDF({ orientation: w > h ? "landscape" : "portrait", unit: "pt", format: "a4" });
    const pw = doc.internal.pageSize.getWidth() - 60;
    doc.setFontSize(13);
    doc.text(title ?? "Grafiek", 30, 36);
    doc.setFontSize(8);
    doc.text(`Bron: Politierechter.nl op basis van Open Data van de Rechtspraak — geëxporteerd ${new Date().toLocaleString("nl-NL")}`, 30, 50);
    doc.addImage(url, "PNG", 30, 62, pw, (pw * h) / w);
    doc.save(`${filename}.pdf`);
  };

  return (
    <div>
      <div className="no-print mb-1 flex justify-end gap-1 text-[11px]">
        {table && <button onClick={() => setShowTable(!showTable)} className="rounded px-2 py-1 text-[var(--ink-3)] hover:bg-mist hover:text-navy">{showTable ? "Grafiek" : "Tabel"}</button>}
        <button onClick={png} className="rounded px-2 py-1 text-[var(--ink-3)] hover:bg-mist hover:text-navy">PNG</button>
        <button onClick={pdf} className="rounded px-2 py-1 text-[var(--ink-3)] hover:bg-mist hover:text-navy">PDF</button>
      </div>
      <div ref={ref} role="img" aria-label={ariaLabel ?? title} style={{ height, width: "100%", display: showTable ? "none" : "block" }} />
      {showTable && table && (
        <div className="max-h-[420px] overflow-auto">
          <table className="table-x">
            <thead><tr>{table.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>{table.rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{v ?? "–"}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function withDefaults(o: EChartsOption): EChartsOption {
  return {
    textStyle: { fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", color: "#4a5a70" },
    animationDuration: 400,
    grid: { left: 8, right: 16, top: 28, bottom: 8, containLabel: true },
    ...o,
    tooltip: o.tooltip === undefined ? undefined : { backgroundColor: "#fff", borderColor: "#e3e8ee", textStyle: { color: "#14263d", fontSize: 12 }, extraCssText: "box-shadow:0 4px 16px rgba(20,38,61,.12);border-radius:8px;", ...(o.tooltip as object) },
  };
}

export const AXIS = {
  axisLine: { lineStyle: { color: "#cfd7e1" } },
  axisTick: { show: false },
  splitLine: { lineStyle: { color: "#eef1f5" } },
  axisLabel: { color: "#6b7a8f", fontSize: 11 },
  nameTextStyle: { color: "#6b7a8f", fontSize: 11 },
} as const;
