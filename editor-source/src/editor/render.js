import { WIDTH, HEIGHT, FONT_SCALE, FONTS, clamp } from './model.js';
const images = new Map();
export async function loadImage(src) {
  if (!images.has(src)) images.set(src, new Promise((resolve, reject) => {
    const image = new Image(); image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => { images.delete(src); reject(new Error('배경 이미지를 읽지 못했어요. 다른 이미지를 선택해주세요.')); };
    image.src = src;
  }));
  return images.get(src);
}
export async function loadFonts(layers) {
  await Promise.all(layers.map(l => document.fonts.load(`${l.fontWeight} ${l.fontSize * FONT_SCALE}px ${FONTS.find(f => f.id === l.fontFamily)?.family || FONTS[0].family}`)));
}
function stroke(ctx, color, width, draw) { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); draw(); ctx.stroke(); }
export function drawTemplate(ctx, background, width = WIDTH, height = HEIGHT) {
  ctx.save(); ctx.scale(width / WIDTH, height / HEIGHT);
  const variant = background.variant || 0;
  ctx.fillStyle = background.color; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  if (background.id === 'blank') { ctx.restore(); return; }
  if (background.id === 'sage') {
    ctx.fillStyle = '#c5cdb740'; ctx.beginPath(); ctx.ellipse(1110, 40, 340, 480, -.45, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#acb99b44'; ctx.beginPath(); ctx.ellipse(1080, 480, 400, 280, -.6, 0, Math.PI * 2); ctx.fill();
    stroke(ctx, '#81917070', 1.4, () => ctx.ellipse(1160 - variant * 25, 560, 370, 400, -.15, 0, Math.PI * 2));
  } else if (background.id === 'navy') {
    stroke(ctx, '#738a9780', 1.3, () => { ctx.moveTo(965 - variant * 30, 0); ctx.lineTo(965 - variant * 30, HEIGHT); });
    stroke(ctx, '#738a9780', 1.3, () => ctx.arc(1140, 570 - variant * 25, 330, 0, Math.PI * 2));
    stroke(ctx, '#738a9740', 1.3, () => ctx.arc(1140, 570 - variant * 25, 420, 0, Math.PI * 2));
  } else {
    stroke(ctx, '#405b46bb', 1.6, () => { ctx.moveTo(992 - variant * 30, 0); ctx.lineTo(992 - variant * 30, 218); });
    stroke(ctx, '#405b46bb', 1.6, () => ctx.arc(1245, 665 - variant * 30, 485, Math.PI, Math.PI * 2));
    stroke(ctx, '#405b46bb', 1.6, () => ctx.arc(1058, 575 - variant * 20, 168, 0, Math.PI * 2));
  }
  ctx.restore();
}
export async function drawBackground(ctx, background, width = WIDTH, height = HEIGHT) {
  if (background.type !== 'image') { drawTemplate(ctx, background, width, height); return; }
  const image = await loadImage(background.src);
  ctx.fillStyle = background.color || '#ffffff'; ctx.fillRect(0, 0, width, height);
  const scale = Math.max(width / image.width, height / image.height);
  ctx.drawImage(image, (width - image.width * scale) / 2, (height - image.height * scale) / 2, image.width * scale, image.height * scale);
}
const textWidth = (ctx, text, spacing) => ctx.measureText(text).width + Math.max(0, Array.from(text).length - 1) * spacing;
function wrap(ctx, text, width, spacing) {
  return text.split('\n').flatMap(paragraph => {
    if (!paragraph) return [''];
    const lines = []; let line = '';
    for (const char of Array.from(paragraph)) {
      if (line && textWidth(ctx, line + char, spacing) > width) { lines.push(line.trimEnd()); line = char.trimStart(); }
      else line += char;
    }
    lines.push(line); return lines;
  });
}
export function layoutLayer(ctx, layer, bounds = { width: WIDTH, height: HEIGHT }) {
  const { width: cardWidth, height: cardHeight } = bounds;
  const family = FONTS.find(f => f.id === layer.fontFamily)?.family || FONTS[0].family;
  const x = clamp(layer.x, 0, cardWidth - 24);
  let y = clamp(layer.y, 0, cardHeight - 22);
  const availableWidth = Math.max(24, Math.min(layer.width, cardWidth - x - 10));
  // Allow the rendered block to move up if a long paragraph cannot fit below its anchor.
  const availableHeight = Math.max(8, cardHeight - y - 8);
  let size = layer.fontSize * FONT_SCALE, spacing, lines;
  do {
    ctx.font = `${layer.fontWeight} ${size}px ${family}`;
    spacing = layer.tracking * FONT_SCALE;
    lines = wrap(ctx, layer.text, availableWidth, spacing);
    const widest = Math.max(0, ...lines.map(line => textWidth(ctx, line, spacing)));
    if ((lines.length * size * 1.3 <= availableHeight && widest <= availableWidth) || size <= 3) break;
    size -= 1;
  } while (size > 2);
  y = Math.min(y, Math.max(0, cardHeight - lines.length * size * 1.3 - 8));
  const widths = lines.map(text => textWidth(ctx, text, spacing));
  const width = Math.max(16, ...widths);
  const offset = layer.align === 'right' ? availableWidth - width : layer.align === 'center' ? (availableWidth - width) / 2 : 0;
  return { x: x + offset, y, width, height: Math.max(size * 1.3, lines.length * size * 1.3), lines, widths, size, spacing, family, availableWidth, baseX: x };
}
function drawText(ctx, layer, box) {
  ctx.font = `${layer.fontWeight} ${box.size}px ${box.family}`;
  ctx.fillStyle = layer.color; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  box.lines.forEach((line, index) => {
    let x = box.baseX + (layer.align === 'right' ? box.availableWidth - box.widths[index] : layer.align === 'center' ? (box.availableWidth - box.widths[index]) / 2 : 0);
    const y = box.y + index * box.size * 1.3;
    if (!box.spacing) ctx.fillText(line, x, y);
    else for (const char of Array.from(line)) { ctx.fillText(char, x, y); x += ctx.measureText(char).width + box.spacing; }
  });
}
export async function renderCard(canvas, doc, scale = 1) {
  await loadFonts(doc.layers);
  // Prepare the background before painting, so a stale asynchronous render cannot paint over a newer one.
  if (doc.background.type === 'image') await loadImage(doc.background.src);
  canvas.width = Math.round(doc.width * scale); canvas.height = Math.round(doc.height * scale);
  const ctx = canvas.getContext('2d'); ctx.scale(canvas.width / doc.width, canvas.height / doc.height);
  await drawBackground(ctx, doc.background, doc.width, doc.height);
  const boxes = {};
  for (const layer of doc.layers) {
    const box = layoutLayer(ctx, layer, doc); boxes[layer.id] = box;
    if (layer.text) drawText(ctx, layer, box);
  }
  return boxes;
}
export async function cardDataURL(doc) {
  const canvas = document.createElement('canvas'); await renderCard(canvas, doc); return canvas.toDataURL('image/png');
}
export async function cardBlob(doc, format, scale) {
  const canvas = document.createElement('canvas'); await renderCard(canvas, doc, scale);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, format === 'jpeg' ? 'image/jpeg' : 'image/png', .96));
  if (!blob) throw new Error('이미지를 만들지 못했어요. 다시 시도해주세요.');
  return blob;
}
export async function exportCard(doc, format, scale, suffix = '') {
  const blob = await cardBlob(doc, format, scale);
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = `${doc.title.replace(/[\\/:*?"<>|]/g, '_') || '명함'}${suffix}.${format === 'jpeg' ? 'jpg' : 'png'}`;
  document.body.append(anchor); anchor.click(); anchor.remove();
  // Browser download completion cannot be observed here; never report it as a saved file.
  setTimeout(() => URL.revokeObjectURL(url), 120000);
  return { status: 'download_requested', filename: anchor.download };
}
