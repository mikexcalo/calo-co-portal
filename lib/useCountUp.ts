import { useState, useEffect, useRef } from 'react';

export default function useCountUp(target: number, duration = 600): number {
  const [display, setDisplay] = useState(target);
  const firstRender = useRef(true);
  const prevTarget = useRef(target);

  useEffect(() => {
    // First render: show final value instantly
    if (firstRender.current) {
      firstRender.current = false;
      prevTarget.current = target;
      setDisplay(target);
      return;
    }

    // No change
    if (prevTarget.current === target) return;

    const from = prevTarget.current;
    prevTarget.current = target;
    const start = performance.now();

    function tick(now: number) {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setDisplay(from + (target - from) * ease);
      if (p < 1) requestAnimationFrame(tick);
      else setDisplay(target); // snap to exact final value
    }

    requestAnimationFrame(tick);
  }, [target, duration]);

  return display;
}
