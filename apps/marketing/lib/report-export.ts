/**
 * Generate an HTML report from all open analysis data.
 * The report is opened in a new window so the user can print/save as PDF.
 */

import type { SpreadsheetData } from './spreadsheet-data-store';
import type { Tab } from './types/tabs';

interface ReportData {
  tabs: Tab[];
  spreadsheetData: Record<string, SpreadsheetData>;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString();
  if (Math.abs(n) < 0.001 && n !== 0) return n.toExponential(3);
  return n.toFixed(4);
}

export function generateReport({ tabs, spreadsheetData }: ReportData): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Gather spreadsheet summaries
  const spreadsheetSections: string[] = [];
  const spreadsheetTabs = tabs.filter((t) => t.type === 'spreadsheet');

  for (const tab of spreadsheetTabs) {
    const data = spreadsheetData[tab.id];
    if (!data || data.columns.length === 0) continue;

    const numericStats = data.columnStats.filter((s) => s.type === 'numeric');
    const textStats = data.columnStats.filter((s) => s.type === 'text');

    let statsTable = '';
    if (numericStats.length > 0) {
      statsTable += `
        <h3>Numeric Variables</h3>
        <table>
          <thead>
            <tr>
              <th>Variable</th>
              <th>Mean</th>
              <th>Median</th>
              <th>Std Dev</th>
              <th>Min</th>
              <th>Max</th>
              <th>Missing</th>
            </tr>
          </thead>
          <tbody>
            ${numericStats
              .map(
                (s) => `
              <tr>
                <td><strong>${escapeHtml(s.name)}</strong></td>
                <td>${s.mean !== undefined ? formatNumber(s.mean) : '-'}</td>
                <td>${s.median !== undefined ? formatNumber(s.median) : '-'}</td>
                <td>${s.stdDev !== undefined ? formatNumber(s.stdDev) : '-'}</td>
                <td>${s.min !== undefined ? formatNumber(s.min) : '-'}</td>
                <td>${s.max !== undefined ? formatNumber(s.max) : '-'}</td>
                <td>${s.missingCount}</td>
              </tr>`,
              )
              .join('')}
          </tbody>
        </table>`;
    }

    if (textStats.length > 0) {
      statsTable += `
        <h3>Categorical Variables</h3>
        <table>
          <thead>
            <tr>
              <th>Variable</th>
              <th>Unique Values</th>
              <th>Missing</th>
              <th>Top Values</th>
            </tr>
          </thead>
          <tbody>
            ${textStats
              .map(
                (s) => `
              <tr>
                <td><strong>${escapeHtml(s.name)}</strong></td>
                <td>${s.uniqueCount}</td>
                <td>${s.missingCount}</td>
                <td>${(s.topValues ?? []).slice(0, 3).map((tv) => `${escapeHtml(tv.value)} (${tv.count})`).join(', ')}</td>
              </tr>`,
              )
              .join('')}
          </tbody>
        </table>`;
    }

    // Correlation matrix for numeric columns
    let corrSection = '';
    if (numericStats.length >= 2) {
      const numCols = numericStats.map((s) => s.name);
      const numRows = data.rows;

      // Compute correlations
      const getNumericValues = (col: string) =>
        numRows.map((r) => parseFloat((r[col] ?? '').replace(/,/g, ''))).filter((v) => !isNaN(v));

      const correlations: number[][] = numCols.map((col1) => {
        const vals1 = getNumericValues(col1);
        const mean1 = vals1.reduce((a, b) => a + b, 0) / vals1.length;
        return numCols.map((col2) => {
          const vals2 = getNumericValues(col2);
          const mean2 = vals2.reduce((a, b) => a + b, 0) / vals2.length;
          const n = Math.min(vals1.length, vals2.length);
          let sumXY = 0, sumX2 = 0, sumY2 = 0;
          for (let i = 0; i < n; i++) {
            const dx = vals1[i] - mean1;
            const dy = vals2[i] - mean2;
            sumXY += dx * dy;
            sumX2 += dx * dx;
            sumY2 += dy * dy;
          }
          const denom = Math.sqrt(sumX2 * sumY2);
          return denom > 0 ? sumXY / denom : 0;
        });
      });

      corrSection = `
        <h3>Correlation Matrix</h3>
        <table class="corr-table">
          <thead>
            <tr>
              <th></th>
              ${numCols.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${numCols
              .map(
                (c, i) => `
              <tr>
                <td><strong>${escapeHtml(c)}</strong></td>
                ${correlations[i].map((v) => {
                  const abs = Math.abs(v);
                  const color = abs > 0.7 ? '#6366f1' : abs > 0.4 ? '#818cf8' : '#c4c4cc';
                  return `<td style="color:${color}">${v.toFixed(3)}</td>`;
                }).join('')}
              </tr>`,
              )
              .join('')}
          </tbody>
        </table>`;
    }

    // Data preview
    const previewRows = data.rows.slice(0, 10);
    const previewTable = `
      <h3>Data Preview (first ${Math.min(10, data.rows.length)} rows)</h3>
      <table class="data-preview">
        <thead>
          <tr>
            ${data.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${previewRows
            .map(
              (row) => `
            <tr>
              ${data.columns.map((c) => `<td>${escapeHtml(row[c] ?? '')}</td>`).join('')}
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>`;

    spreadsheetSections.push(`
      <section class="dataset">
        <h2>${escapeHtml(tab.title)}</h2>
        <div class="meta">
          ${data.rows.length.toLocaleString()} rows &middot; ${data.columns.length} columns &middot;
          ${numericStats.length} numeric &middot; ${textStats.length} categorical
        </div>
        ${statsTable}
        ${corrSection}
        ${previewTable}
      </section>`);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VARYN Report — ${dateStr}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 24px;
      color: #1a1a2e;
      line-height: 1.6;
      background: #fafafa;
    }
    header {
      border-bottom: 2px solid #6366f1;
      padding-bottom: 16px;
      margin-bottom: 32px;
    }
    header h1 {
      font-size: 28px;
      font-weight: 700;
      color: #6366f1;
      letter-spacing: -0.5px;
    }
    header .date {
      color: #6b7280;
      font-size: 13px;
      margin-top: 4px;
    }
    section.dataset {
      margin-bottom: 48px;
      page-break-inside: avoid;
    }
    h2 {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 8px;
      color: #1e1b4b;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 8px;
    }
    h3 {
      font-size: 14px;
      font-weight: 600;
      margin: 20px 0 8px;
      color: #374151;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .meta {
      font-size: 13px;
      color: #6b7280;
      margin-bottom: 16px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 12px;
    }
    th, td {
      padding: 6px 10px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }
    th {
      font-weight: 600;
      color: #374151;
      background: #f3f4f6;
    }
    td {
      font-variant-numeric: tabular-nums;
    }
    .corr-table td, .corr-table th {
      text-align: center;
      font-size: 11px;
      padding: 4px 6px;
    }
    .data-preview {
      font-size: 11px;
    }
    .data-preview td {
      white-space: nowrap;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    footer {
      margin-top: 48px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
      font-size: 11px;
      color: #9ca3af;
      text-align: center;
    }
    @media print {
      body { padding: 20px; background: white; }
      section.dataset { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <header>
    <h1>VARYN Analysis Report</h1>
    <div class="date">${dateStr}</div>
  </header>
  ${spreadsheetSections.length > 0
    ? spreadsheetSections.join('\n')
    : '<p style="color:#6b7280">No datasets loaded. Open a spreadsheet to include data in the report.</p>'}
  <footer>
    Generated by VARYN Statistical Workspace &middot; varyn.cloud
  </footer>
</body>
</html>`;
}

export function openReport(html: string): void {
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
