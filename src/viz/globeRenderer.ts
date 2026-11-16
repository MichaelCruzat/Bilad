import {geoGraticule10, geoPath, type GeoPermissibleObjects} from 'd3-geo';
import type {GlobalCells} from '../lib/globalData';
import {globeTexturePoint, globeTextureProjection} from './globeTexture';

type Camera = {lon: number; lat: number};
export type GlobeRenderer = {
  canvas: HTMLCanvasElement;
  paint: (width: number, height: number, radius: number, camera: Camera) => boolean;
  dispose: () => void;
};

/**
 * Paint the native grid to a geographic texture once per data mode. A fragment
 * shader then projects it to the sphere: camera motion does not rebuild 54k paths.
 * Nearest-neighbour sampling preserves categorical verdicts and cell colours.
 * A separate canvas lets the existing 2D renderer remain a fallback.
 */
export function createGlobeRenderer(cells: GlobalCells, groups: [string, number[]][], borders: {inner: GeoPermissibleObjects; coast: GeoPermissibleObjects} | null): GlobeRenderer | null {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl', {alpha: true, premultipliedAlpha: false, antialias: false, preserveDrawingBuffer: true});
  if (!gl) return null;
  const release = () => gl.getExtension('WEBGL_lose_context')?.loseContext();
  try {
    const shader = (type: number, source: string) => {
      const value = gl.createShader(type);
      if (!value) throw new Error('Could not allocate shader');
      gl.shaderSource(value, source);
      gl.compileShader(value);
      if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) {
        gl.deleteShader(value);
        throw new Error('Globe shader compilation failed');
      }
      return value;
    };
    const vertex = shader(gl.VERTEX_SHADER, `
      attribute vec2 position;
      void main() { gl_Position = vec4(position, 0.0, 1.0); }
    `);
    const fragment = shader(gl.FRAGMENT_SHADER, `
      precision highp float;
      uniform vec2 resolution;
      uniform float radius;
      uniform vec3 camera;
      uniform sampler2D atlas;
      const float PI = 3.141592653589793;
      void main() {
        vec2 p = (gl_FragCoord.xy - resolution * 0.5) / radius;
        float r2 = dot(p, p);
        if (r2 > 1.0) { gl_FragColor = vec4(0.0); return; }
        float z = sqrt(max(0.0, 1.0-r2));
        float latitude = asin(clamp(p.y * camera.z + z * camera.y, -1.0, 1.0));
        float longitude = camera.x + atan(p.x, z * camera.z - p.y * camera.y);
        vec2 uv = vec2(fract(longitude / (2.0*PI) + 0.5), latitude / PI + 0.5);
        gl_FragColor = texture2D(atlas, uv);
      }
    `);
    const program = gl.createProgram();
    if (!program) throw new Error('Could not allocate program');
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Globe shader link failed');
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    // Two texels per cell align both the native centres and half-cell bounds.
    const surface = document.createElement('canvas');
    surface.width = 1152;
    surface.height = 720;
    const ctx = surface.getContext('2d');
    if (!ctx) throw new Error('Could not paint geographic texture');
    ctx.fillStyle = '#d5dcd8';
    ctx.fillRect(0, 0, surface.width, surface.height);
    for (const [color, list] of groups) {
      ctx.fillStyle = color;
      for (const c of list) {
        const [x, y] = globeTexturePoint(cells.lon[c], cells.lat[c], surface.width, surface.height);
        ctx.fillRect(x - 1, y - 1, 2, 2);
        if (x < 1) ctx.fillRect(x - 1 + surface.width, y - 1, 2, 2);
      }
    }
    const path = geoPath(globeTextureProjection(surface.width, surface.height), ctx);
    const line = (shape: GeoPermissibleObjects, color: string, width: number) => {
      ctx.beginPath();
      path(shape);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
    };
    line(geoGraticule10(), 'rgba(28,26,23,0.08)', 0.6);
    if (borders) {
      line(borders.coast, 'rgba(28,26,23,0.55)', 0.7);
      line(borders.inner, 'rgba(28,26,23,0.3)', 0.5);
    }
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, surface);
    const resolution = gl.getUniformLocation(program, 'resolution');
    const radius = gl.getUniformLocation(program, 'radius');
    const camera = gl.getUniformLocation(program, 'camera');
    return {
      canvas,
      paint(width, height, r, view) {
        if (gl.isContextLost()) return false;
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
          gl.viewport(0, 0, width, height);
        }
        gl.uniform2f(resolution, width, height);
        gl.uniform1f(radius, r);
        const phi = view.lat * Math.PI / 180;
        gl.uniform3f(camera, view.lon * Math.PI / 180, Math.sin(phi), Math.cos(phi));
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        return true;
      },
      dispose() {
        gl.deleteTexture(texture);
        gl.deleteBuffer(buffer);
        gl.deleteProgram(program);
        release();
      },
    };
  } catch {
    release();
    return null;
  }
}
