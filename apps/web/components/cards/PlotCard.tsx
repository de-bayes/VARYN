interface PlotCardProps {
  title: string;
  imageUrl: string;
}

export function PlotCard({ title, imageUrl }: PlotCardProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-panel">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
        <span className="text-xs font-medium text-foreground">{title}</span>
        <span className="text-[10px] text-muted/60">plot</span>
      </div>
      <div className="p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={title}
          className="w-full rounded-lg"
        />
      </div>
    </div>
  );
}
