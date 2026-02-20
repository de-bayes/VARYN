'use client';

import { useEffect, useRef } from 'react';

const chars = ' .,:-=+*#%@';

const gaussian = (x: number, mean: number, sigma: number) => {
  const z = (x - mean) / sigma;
  return Math.exp(-0.5 * z * z);
};

const sampleNormal = (mean: number, sigma: number) => {
  const u1 = Math.max(Number.EPSILON, Math.random());
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * sigma;
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
    let histogram = new Float32Array(0);

    const draw = (time = 0) => {
      const { width, height } = canvas;
      context.fillStyle = '#090a0f';
      context.fillRect(0, 0, width, height);
      context.font = '13px ui-monospace, SFMono-Regular, Menlo, monospace';
      context.textBaseline = 'middle';

      const stepX = 9;
      const stepY = 14;
      const cols = Math.max(10, Math.floor(width / stepX));
      const rows = Math.max(10, Math.floor(height / stepY));
      const topPadding = 2;
      const bottomPadding = 3;
      const usableRows = rows - topPadding - bottomPadding;
      const t = time * 0.001;

      if (histogram.length !== cols) {
        histogram = new Float32Array(cols);
      }

      for (let i = 0; i < cols; i += 1) {
        histogram[i] *= 0.94;
      }

      const phase = Math.sin(t * 0.7);
      const mix = 0.5 + 0.25 * Math.sin(t * 0.36);
      const meanA = -0.75 + phase * 0.6;
      const meanB = 0.95 + Math.cos(t * 0.48) * 0.55;
      const sigmaA = 0.36 + 0.08 * Math.cos(t * 0.82);
      const sigmaB = 0.44 + 0.1 * Math.sin(t * 0.61);
      const sampleCount = reduceMotion ? 170 : 260;

      for (let i = 0; i < sampleCount; i += 1) {
        const chooseA = Math.random() < mix;
        const sample = chooseA ? sampleNormal(meanA, sigmaA) : sampleNormal(meanB, sigmaB);
        const normalized = Math.max(0, Math.min(1, (sample + 3) / 6));
        const col = Math.min(cols - 1, Math.floor(normalized * cols));
        histogram[col] += 1.35;
      }

      let peak = 0;
      for (let i = 0; i < cols; i += 1) {
        peak = Math.max(peak, histogram[i]);
      }
      peak = Math.max(peak, 1);

      for (let col = 0; col < cols; col += 1) {
        const xProgress = col / cols;
        const xN = xProgress * 6 - 3;
        const curve = mix * gaussian(xN, meanA, sigmaA) + (1 - mix) * gaussian(xN, meanB, sigmaB);
        const curveRow = Math.floor(topPadding + usableRows * (1 - Math.min(1, curve)));

        const normalizedBar = Math.min(1, histogram[col] / peak);
        const barHeight = Math.floor(normalizedBar * usableRows);

        for (let y = 0; y < usableRows; y += 1) {
          const row = rows - bottomPadding - 1 - y;
          let intensity = 0;

          if (y < barHeight) {
            const fillProgress = y / Math.max(1, usableRows - 1);
            intensity = 0.24 + normalizedBar * 0.74 - fillProgress * 0.12;
          }

          const distanceToCurve = Math.abs(row - curveRow);
          if (distanceToCurve === 0) intensity = Math.max(intensity, 0.96);
          if (distanceToCurve === 1) intensity = Math.max(intensity, 0.72);

          if (intensity < 0.1) continue;

          const charIndex = Math.min(chars.length - 1, Math.floor(intensity * (chars.length - 1)));
          context.fillStyle = `rgba(240, 245, 255, ${0.1 + intensity * 0.62})`;
          context.fillText(chars[charIndex], col * stepX, row * stepY + stepY / 2);
        }
      }

      const centerCol = 8;
      const centerRow = 4;
      const burstRadius = 2.2;
      const spokes = 14;
      for (let i = 0; i < spokes; i += 1) {
        const angle = (i / spokes) * Math.PI * 2 + t * 0.9;
        const radius = burstRadius + Math.sin(t * 1.8 + i) * 0.9;
        const x = Math.round(centerCol + Math.cos(angle) * radius);
        const y = Math.round(centerRow + Math.sin(angle) * radius * 0.72);
        const sparkle = i % 3 === 0 ? '*' : '.';
        context.fillStyle = 'rgba(196, 216, 244, 0.72)';
        context.fillText(sparkle, x * stepX, y * stepY + stepY / 2);
      }

      context.fillStyle = 'rgba(220, 235, 255, 0.88)';
      context.fillText('✶', centerCol * stepX, centerRow * stepY + stepY / 2);
      context.fillStyle = 'rgba(189, 206, 232, 0.46)';
      context.fillText('Monte Carlo cloud', stepX, stepY * 2 + stepY / 2);

      context.fillStyle = 'rgba(189, 206, 232, 0.55)';
      context.fillText('outcomes →', stepX, (rows - 1) * stepY + stepY / 2);
      context.fillText('probability', stepX, stepY + stepY / 2);
    };

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      draw(performance.now());
    };

    resize();
    window.addEventListener('resize', resize);
    if (!reduceMotion) {
      frameId = window.requestAnimationFrame(function loop(now) {
        draw(now);
        frameId = window.requestAnimationFrame(loop);
      });
    }

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
