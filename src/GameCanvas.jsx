import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { createEngine } from './engine';

const GameCanvas = forwardRef(function GameCanvas(props, ref) {
  const canvas = useRef(null);
  const engine = useRef(null);
  const current = useRef(props);
  current.current = props;
  useImperativeHandle(ref, () => ({ emp: () => engine.current?.emp(), dash: () => engine.current?.dash(), complete: () => engine.current?.complete(), grantShards: amount => engine.current?.grantShards(amount), markDemo: () => engine.current?.markDemo(), runState: () => engine.current?.runState(), snapshot: () => engine.current?.snapshot() }), []);
  useEffect(() => {
    engine.current = createEngine(canvas.current, {
      ...current.current,
      handleEscape: false,
      isPaused: () => current.current.paused,
      isGod: () => current.current.godMode,
      isTouchOverclock: () => current.current.touchOverclock,
      onPause: () => current.current.onPause(),
      onBlur: () => current.current.onBlur(),
      onHud: data => current.current.onHud(data),
      onEnd: data => current.current.onEnd(data),
      onAchievement: data => current.current.onAchievement(data),
    });
    return () => engine.current?.destroy();
  }, [props.session, props.level, props.active]);
  return <canvas ref={canvas} className="game-canvas" aria-label="Protocol Overclock game arena. WASD to move, aim and hold mouse to fire, Space for Overclock, Q for EMP, Shift or right click for Cyber Dash, Escape to pause." tabIndex={0} />;
});
export default GameCanvas;
