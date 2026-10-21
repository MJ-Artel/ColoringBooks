// The art supplies. Each tool names a deposit model the engine knows how to render:
//   grain   - pigment catches on the paper's tooth; pressure decides how far into the valleys it reaches
//   wash    - translucent watercolour with blotches, granulation and a darker rim where it dries
//   ink     - even marker ink; multiply blending, so overlaps and layers deepen
//   glitter - opaque gel ink with sparkles
//   flat    - solid paint (paint bucket only)
//   erase   - takes colour away
// Sizes are brush radii in page pixels (pages are about 1200 px tall): [smallest, largest, default].

const rgb = (hex) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));

export const TOOLS = {
  pencil: {
    id: 'pencil', name: 'Pencil crayon', short: 'Pencil crayon', model: 'grain', tex: 'paper', blend: 'normal',
    size: [1.5, 18, 4], hardness: 0.55, soft: 0.28, bite: 1.4, opacity: 0.92, pressure: true, spacing: 0.2,
  },
  crayon: {
    id: 'crayon', name: 'Wax crayon', short: 'Crayon', model: 'grain', tex: 'crayon', blend: 'normal',
    size: [4, 40, 12], hardness: 0.4, soft: 0.12, bite: 1.35, opacity: 0.97, jitter: 0.1, pressure: true, spacing: 0.15,
  },
  watercolour: {
    id: 'watercolour', name: 'Watercolour', short: 'Watercolour', model: 'wash', blend: 'multiply',
    size: [5, 100, 26], hardness: 0.6, load: 0.5, blotch: 0.55, granulation: 0.5, pressure: true, spacing: 0.12,
    dry: { blur: 0.18, edge: 0.9, bleed: 0.3 },
  },
  marker: {
    id: 'marker', name: 'Felt-tip marker', short: 'Felt tip', model: 'ink', blend: 'multiply',
    size: [3, 28, 9], hardness: 0.85, opacity: 0.88, streak: 0.12, spacing: 0.12, dry: { blur: 0.15, edge: 0.3 },
  },
  alcohol: {
    id: 'alcohol', name: 'Alcohol marker (chisel tip)', short: 'Alcohol marker', model: 'ink', blend: 'multiply',
    size: [4, 48, 16], hardness: 0.8, opacity: 0.55, spacing: 0.12, chisel: { aspect: 0.38, angle: -35 },
  },
  glitter: {
    id: 'glitter', name: 'Glitter gel pen', short: 'Glitter pen', model: 'glitter', blend: 'normal',
    size: [2, 18, 6], hardness: 0.85, opacity: 0.93, spacing: 0.15,
  },
  graphite: {
    id: 'graphite', name: 'Graphite pencil', short: 'Pencil', model: 'grain', tex: 'paper', blend: 'multiply',
    size: [1, 12, 2.5], hardness: 0.6, soft: 0.28, bite: 1.35, opacity: 0.8, pressure: true, spacing: 0.2,
    fixedColour: rgb('#57534c'),
  },
  fill: { id: 'fill', name: 'Paint bucket', short: 'Fill', model: 'fill' },
  eraser: {
    id: 'eraser', name: 'Eraser', short: 'Eraser', model: 'erase', blend: 'normal',
    size: [4, 80, 18], hardness: 0.7, spacing: 0.12,
  },
};

export const TOOL_ORDER = ['pencil', 'crayon', 'watercolour', 'marker', 'alcohol', 'glitter', 'graphite', 'fill', 'eraser'];

// What the paint bucket fills a shape with.
export const FLAT = { id: 'flat', name: 'Flat paint', model: 'flat', blend: 'normal' };
export const FILL_LOOKS = [
  ['flat', 'Paint'],
  ['pencil', 'Pencil'],
  ['crayon', 'Crayon'],
  ['watercolour', 'Watercolour'],
  ['marker', 'Marker'],
  ['glitter', 'Glitter'],
];
export const lookTool = (id) => (id === 'flat' ? FLAT : TOOLS[id] || FLAT);

// Size slider (0-100) <-> radius, on a log scale so small sizes get most of the travel.
export const radiusFor = (tool, v) => tool.size[0] * Math.pow(tool.size[1] / tool.size[0], v / 100);
export const sliderFor = (tool, r) =>
  Math.round((100 * Math.log(r / tool.size[0])) / Math.log(tool.size[1] / tool.size[0]));

export { rgb as hexToRgb };
