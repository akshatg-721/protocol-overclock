import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { createEngine } from './engine';
import { DEFAULT_BINDINGS, keyLabel } from './controls';

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
      getBindings: () => current.current.bindings || DEFAULT_BINDINGS,
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
  useEffect(() => { engine.current?.clearInput(); }, [props.bindings, props.paused]);
  const binding=props.bindings||DEFAULT_BINDINGS;
  return <canvas ref={canvas} className="game-canvas" aria-label={`Protocol Overclock game arena. Move ${[binding.up,binding.left,binding.down,binding.right].map(keyLabel).join(" / ")}. Mouse aim and fire. ${keyLabel(binding.overclock)} Overclock, ${keyLabel(binding.emp)} EMP, ${keyLabel(binding.dash)} Dash. Escape tactical menu.`} tabIndex={0} />;
});
export default GameCanvas;
