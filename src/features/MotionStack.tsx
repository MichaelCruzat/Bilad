import {useEffect, useRef, type ComponentProps} from 'react';
import {VStack} from '@astryxdesign/core/Stack';

/** Compositor-only movement; content stays readable without animation support. */
export function MotionStack({motionKey, reveal = false, ...props}: ComponentProps<typeof VStack> & {motionKey?: string; reveal?: boolean}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof node.animate !== 'function') return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let animation: Animation | undefined;
    const enter = () => {
      if (!preference.matches) animation = node.animate(
        [{opacity: 0.35, transform: 'translateY(1.5rem)'}, {opacity: 1, transform: 'translateY(0)'}],
        {duration: 560, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)'},
      );
    };
    const stop = () => animation?.cancel();
    preference.addEventListener('change', stop);
    let observer: IntersectionObserver | undefined;
    if (reveal && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting)) { enter(); observer?.disconnect(); }
      }, {threshold: 0.15});
      observer.observe(node);
    } else enter();
    return () => { observer?.disconnect(); stop(); preference.removeEventListener('change', stop); };
  }, [motionKey, reveal]);
  return <VStack {...props} ref={ref} />;
}
