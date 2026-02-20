'use client';

import { useEffect, useRef } from 'react';

const chars = '.:-=+*#%@/\\|';

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
      context.fillStyle = '#101113';
      context.fillRect(0, 0, width, height);
      context.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace';

      for (let y = 0; y < height; y += 14) {
        for (let x = 0; x < width; x += 9) {
          const wave = Math.sin((x + y) * 0.02 + time * 0.00035) * 0.5 + 0.5;
          const idx = Math.floor(wave * (chars.length - 1));
          const char = chars[idx];
          context.fillStyle = `rgba(185, 164, 123, ${0.08 + wave * 0.18})`;
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
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/30 via-transparent to-background/70" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}
