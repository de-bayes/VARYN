'use client';

import { useEffect, useRef } from 'react';

const chars = ' .~≈-';

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
      context.font = '13px ui-monospace, SFMono-Regular, Menlo, monospace';

      for (let y = 24; y < height; y += 14) {
        const row = y / 14;
        const rowFrequency = 0.02 + (row % 7) * 0.0026;
        const rowVelocity = 0.00085 + (row % 5) * 0.00019;
        const rowPhase = row * 0.46;
        const rowSpread = 0.014 + (row % 6) * 0.0032;
        const rowAmplitude = 0.54 + (row % 4) * 0.12;

        for (let x = 0; x < width; x += 9) {
          const distance = Math.max(0, x);
          const wavefront = Math.sin(distance * rowFrequency - time * rowVelocity + rowPhase);
          const diffusion = Math.sin(distance * rowSpread + time * (rowVelocity * 1.4) + row * 0.17) * 0.42;
          const harmonic = Math.sin(distance * 0.0075 + row * 0.31 - time * 0.0004) * 0.36;
          const envelope = Math.exp(-distance / (width * (0.72 + (row % 3) * 0.1)));
          const wave = (wavefront * rowAmplitude + diffusion + harmonic) * envelope;
          const normalized = Math.max(0, Math.min(1, wave * 0.5 + 0.5));
          const idx = Math.floor(normalized * (chars.length - 1));
          const char = chars[idx];
          context.fillStyle = `rgba(244, 244, 241, ${0.1 + normalized * 0.32})`;
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
