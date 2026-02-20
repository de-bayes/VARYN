'use client';

import { useEffect, useRef } from 'react';

const chars = ' .,:-~=+*';
const sourceX = 24;

const rowSignal = (row: number) => {
  const seed = row * 12.9898;
  const phase = Math.sin(seed) * 43758.5453;
  const normalized = phase - Math.floor(phase);

  return {
    freq: 0.018 + normalized * 0.028,
    amp: 0.24 + normalized * 0.38,
    speed: 0.0007 + normalized * 0.0012,
    spread: 36 + normalized * 54,
    drift: normalized * 0.7
  };
};

export function AsciiWaveHero() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frameId = 0;

    const draw = (time = 0) => {
      const { width, height } = canvas;
      context.fillStyle = '#0d0d0f';
      context.fillRect(0, 0, width, height);
      context.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace';

      for (let y = 18; y < height; y += 12) {
        const signal = rowSignal(y);
        const front = sourceX + ((time * signal.speed) % (width + 220));

        for (let x = 0; x < width; x += 8) {
          const distance = x - front;
          const envelope = Math.exp(-(distance * distance) / (2 * signal.spread * signal.spread));
          const carrier = Math.sin(x * signal.freq - time * signal.speed * 1.6 + y * signal.drift);
          const bands = Math.sin(x * (signal.freq * 0.55) + y * 0.024 + time * 0.00042) * 0.4;
          const density = envelope * (0.6 + carrier * signal.amp + bands);
          const normalized = Math.max(0, Math.min(1, density + 0.08));
          const char = chars[Math.floor(normalized * (chars.length - 1))];

          if (normalized <= 0.03) continue;
          context.fillStyle = `rgba(245, 245, 242, ${0.06 + normalized * 0.52})`;
          context.fillText(char, x, y);
        }
      }

      if (!reduceMotion) {
        frameId = window.requestAnimationFrame(draw);
      }
    };

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      draw(performance.now());
    };

    resize();
    window.addEventListener('resize', resize);
    if (!reduceMotion) frameId = window.requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <div className="relative h-[74vh] min-h-[480px] overflow-hidden rounded-3xl border border-white/10 bg-background">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
