export const WIDTH = 1080;
export const HEIGHT = 600;
export const PIXELS_PER_MM = 12;
export const MIN_SIZE_MM = 10;
export const MAX_SIZE_MM = 300;
export const FONT_SCALE = 2.4;
export const FONTS = [
  { id: 'sans', label: 'Noto Sans KR', family: '"Noto Sans KR", sans-serif' },
  { id: 'serif', label: 'Noto Serif KR', family: '"Noto Serif KR", serif' },
  { id: 'system', label: '시스템 고딕', family: '"Apple SD Gothic Neo", "Malgun Gothic", sans-serif' },
];
export const TEMPLATES = [
  { id: 'minimal', label: '페이퍼', color: '#fcfbf7', ink: '#183e32', src: '/backgrounds/paper.png', description: '여백이 돋보이는 미니멀한 종이 질감' },
  { id: 'navy', label: '미드나이트', color: '#1b2d39', ink: '#f5f6f0', description: '깊은 네이비와 절제된 선' },
  { id: 'sage', label: '세이지', color: '#e9eddf', ink: '#314d3b', description: '부드러운 세이지 컬러와 유기적인 곡선' },
];
export function templateBackground(template, variant = 0) { return { ...template, type: template.src && variant === 0 ? 'image' : 'template', variant }; }
const textLayer = (id, field, label, text, x, y, width, fontSize, rest = {}) => ({ id, field, label, text, x, y, width, fontSize, fontFamily: 'sans', fontWeight: 400, color: '#183e32', align: 'left', tracking: 0, ...rest });
export function createDocument() {
  return { version: 1, title: '나의 첫 명함', width: WIDTH, height: HEIGHT,
    background: templateBackground(TEMPLATES[0]),
    layers: [
      textLayer('name', 'name', '이름', '김지우', 80, 78, 630, 32, { fontWeight: 700 }),
      textLayer('title', 'title', '직함', '브랜드 디자이너', 82, 192, 630, 17),
      textLayer('company', 'company', '회사', 'STUDIO ABLM', 688, 86, 300, 11, { align: 'right', tracking: 1.8 }),
      textLayer('phone', 'phone', '전화', '010-1234-5678', 82, 418, 800, 11),
      textLayer('email', 'email', '이메일', 'hello@ablm.studio', 82, 460, 800, 11),
      textLayer('address', 'address', '주소', '서울시 마포구 월드컵북로 24', 82, 502, 820, 11),
    ] };
}
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export function cleanLayer(layer, bounds = { width: WIDTH, height: HEIGHT }) {
  const { width, height } = bounds;
  const numeric = (key, fallback) => Number.isFinite(Number(layer[key])) ? Number(layer[key]) : fallback;
  return { ...layer, text: String(layer.text ?? '').slice(0, 500), width: clamp(numeric('width', 720), 40, width - 32),
    x: clamp(numeric('x', 80), 0, width - 40), y: clamp(numeric('y', 80), 0, height - 20),
    fontSize: clamp(numeric('fontSize', 12), 6, 72), fontWeight: layer.fontWeight === 700 ? 700 : 400,
    fontFamily: FONTS.some(f => f.id === layer.fontFamily) ? layer.fontFamily : 'sans',
    color: /^#[0-9a-f]{6}$/i.test(layer.color) ? layer.color : '#183e32',
    align: ['left', 'center', 'right'].includes(layer.align) ? layer.align : 'left', tracking: clamp(numeric('tracking', 0), -1, 5) };
}
export function isDocument(value) {
  const validDimension = n => Number.isFinite(n) && n >= MIN_SIZE_MM * PIXELS_PER_MM && n <= MAX_SIZE_MM * PIXELS_PER_MM;
  return value?.version === 1 && validDimension(value.width) && validDimension(value.height) && typeof value.title === 'string' &&
    value.background && ['template', 'image'].includes(value.background.type) && Array.isArray(value.layers) &&
    value.layers.length <= 30 && value.layers.every(l => typeof l.id === 'string' && typeof l.text === 'string');
}
export function resizeDocument(doc, widthMm, heightMm) {
  const valid = n => Number.isFinite(n) && n >= MIN_SIZE_MM && n <= MAX_SIZE_MM;
  if (!valid(widthMm) || !valid(heightMm)) throw new Error(`가로와 세로를 ${MIN_SIZE_MM}–${MAX_SIZE_MM} mm 사이로 입력해주세요.`);
  const width = Math.round(widthMm * 10) / 10 * PIXELS_PER_MM;
  const height = Math.round(heightMm * 10) / 10 * PIXELS_PER_MM;
  const next = { ...doc, width, height };
  next.layers = doc.layers.map(layer => cleanLayer({ ...layer,
    x: layer.x * width / doc.width, y: layer.y * height / doc.height,
    width: layer.width * width / doc.width,
  }, next));
  return next;
}
// AI may alter presentation only. The client's own text, IDs and background are authoritative.
export function mergeRefinement(original, result) {
  if (!Array.isArray(result?.layers)) throw new Error('배치 결과를 읽지 못했어요. 다시 시도해주세요.');
  const proposals = new Map(result.layers.map(layer => [layer.id, layer]));
  const keys = ['x', 'y', 'width', 'fontSize', 'fontFamily', 'fontWeight', 'align', 'tracking', 'color'];
  return { ...original, layers: original.layers.map(layer => {
    const update = proposals.get(layer.id);
    if (!update) return { ...layer };
    return cleanLayer({ ...layer, ...Object.fromEntries(keys.filter(k => update[k] !== undefined).map(k => [k, update[k]])) }, original);
  }) };
}
