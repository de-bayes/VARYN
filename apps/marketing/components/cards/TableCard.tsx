interface TableCardProps {
  title: string;
  columns: string[];
  rows: Record<string, unknown>[];
}

export function TableCard({ title, columns, rows }: TableCardProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-panel">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
        <span className="text-xs font-medium text-foreground">{title}</span>
        <span className="text-[10px] text-muted/60">{rows.length} rows</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/5">
              {columns.map((col) => (
                <th key={col} className="px-3 py-2 text-left font-medium text-muted/80">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                {columns.map((col) => (
                  <td key={col} className="px-3 py-1.5 text-foreground/90 tabular-nums">
                    {String(row[col] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
