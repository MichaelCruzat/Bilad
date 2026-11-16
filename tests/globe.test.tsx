import {render} from '@testing-library/react';
import {StrictMode} from 'react';
import {afterEach, expect, it, vi} from 'vitest';
import {GlobeMap, type GlobeControls} from '../src/viz/GlobeMap';

afterEach(() => vi.restoreAllMocks());

it('cancels a flight and clears external controls when the globe unmounts', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(123);
  const cancel = vi.spyOn(window, 'cancelAnimationFrame');
  const controls: {current: GlobeControls | null} = {current: null};
  const {unmount} = render(
    <GlobeMap
      cells={{n: 0, lat: new Float32Array(), lon: new Float32Array(), area: new Float32Array(), land: new Float32Array(), country: new Uint16Array()}}
      colorOf={() => null}
      colorKey="test"
      world={null}
      selectedCell={null}
      selectedCountryId={null}
      controls={controls}
      spinning={false}
      onSpinningChange={() => {}}
      title="Test globe"
    />,
  );
  controls.current!.flyTo(-70, -33);
  unmount();
  expect(cancel).toHaveBeenCalledWith(123);
  expect(controls.current).toBeNull();
});

it('restarts the selected-place camera flight after StrictMode effect cleanup', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  let next = 0;
  const pending = new Set<number>();
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => {
    pending.add(++next);
    return next;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { pending.delete(id); });
  const {unmount} = render(
    <StrictMode>
      <GlobeMap
        cells={{n: 0, lat: new Float32Array(), lon: new Float32Array(), area: new Float32Array(), land: new Float32Array(), country: new Uint16Array()}}
        colorOf={() => null}
        colorKey="test"
        world={null}
        selectedCell={null}
        selectedCountryId="050"
        focus={{lon: 90, lat: 24}}
        spinning={false}
        onSpinningChange={() => {}}
        title="Test globe"
      />
    </StrictMode>,
  );
  expect(pending.size).toBe(1);
  unmount();
  expect(pending.size).toBe(0);
});
