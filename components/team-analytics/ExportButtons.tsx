"use client";

import { Download, FileSpreadsheet, FileText, Copy, Check } from "lucide-react";
import { useState } from "react";

type Props = {
  data: any[];
  filename: string;
  columns?: string[];
};

export function ExportButtons({ data, filename, columns }: Props) {
  const [copied, setCopied] = useState(false);

  const headers = columns || (data.length > 0 ? Object.keys(data[0]) : []);

  function toCsvString(): string {
    const rows = data.map(row => headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return "";
      const str = typeof val === "object" ? JSON.stringify(val) : String(val);
      return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(","));
    return [headers.join(","), ...rows].join("\n");
  }

  function downloadFile(content: string, ext: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportCSV() {
    downloadFile(toCsvString(), "csv", "text/csv;charset=utf-8;");
  }

  function exportExcel() {
    // Tab-separated for Excel compatibility
    const rows = data.map(row => headers.map(h => {
      const val = row[h];
      return val === null || val === undefined ? "" : typeof val === "object" ? JSON.stringify(val) : String(val);
    }).join("\t"));
    downloadFile([headers.join("\t"), ...rows].join("\n"), "xls", "application/vnd.ms-excel");
  }

  function exportText() {
    const maxWidths = headers.map(h => Math.max(h.length, ...data.map(r => String(r[h] ?? "").length)));
    const headerLine = headers.map((h, i) => h.padEnd(maxWidths[i])).join(" | ");
    const separator = maxWidths.map(w => "-".repeat(w)).join("-+-");
    const rows = data.map(row => headers.map((h, i) => String(row[h] ?? "").padEnd(maxWidths[i])).join(" | "));
    downloadFile([headerLine, separator, ...rows].join("\n"), "txt", "text/plain");
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(toCsvString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function exportPDF() {
    // Print-friendly HTML that opens as PDF
    const html = `<!DOCTYPE html><html><head><title>${filename}</title><style>
      body{font-family:system-ui;padding:20px;color:#333}
      table{border-collapse:collapse;width:100%;font-size:12px}
      th,td{border:1px solid #ddd;padding:6px 10px;text-align:left}
      th{background:#f5f5f5;font-weight:600}
      tr:nth-child(even){background:#fafafa}
      h1{font-size:18px;margin-bottom:10px}
      .meta{color:#666;font-size:12px;margin-bottom:16px}
    </style></head><body>
    <h1>${filename}</h1>
    <div class="meta">Exported ${new Date().toLocaleString("en-GB", { timeZone: "Europe/London" })}</div>
    <table><thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody>${data.map(row => `<tr>${headers.map(h => `<td>${row[h] ?? ""}</td>`).join("")}</tr>`).join("")}</tbody></table>
    </body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }

  if (data.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      <button onClick={exportCSV} title="Export CSV" className="glass-button rounded-lg p-1.5 text-white/40 hover:text-white transition">
        <Download size={13} />
      </button>
      <button onClick={exportExcel} title="Export Excel" className="glass-button rounded-lg p-1.5 text-white/40 hover:text-white transition">
        <FileSpreadsheet size={13} />
      </button>
      <button onClick={exportPDF} title="Export PDF" className="glass-button rounded-lg p-1.5 text-white/40 hover:text-white transition">
        <FileText size={13} />
      </button>
      <button onClick={copyToClipboard} title="Copy" className="glass-button rounded-lg p-1.5 text-white/40 hover:text-white transition">
        {copied ? <Check size={13} className="text-teal-400" /> : <Copy size={13} />}
      </button>
    </div>
  );
}
