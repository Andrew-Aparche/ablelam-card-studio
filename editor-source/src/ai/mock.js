import { TEMPLATES, cleanLayer, templateBackground } from '../editor/model.js';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
export const mockProvider = {
  mode: 'mock',
  async generateBackground({ prompt, style, variant = 0 }) {
    await delay(900);
    const mentioned = /네이비|남색|어두|고급|navy|dark/i.test(prompt) ? 'navy' : /세이지|초록|녹색|자연|sage|green/i.test(prompt) ? 'sage' : /미니멀|종이|흰색|화이트|paper|white/i.test(prompt) ? 'minimal' : style;
    const template = TEMPLATES.find(t => t.id === mentioned) ?? TEMPLATES[0];
    return { ...templateBackground(template, (variant + 1) % 3), prompt };
  },
  async refineLayout({ document, direction }) {
    await delay(1100);
    const centered = direction === 'center';
    const editorial = direction === 'editorial';
    const ink = document.background.ink || '#183e32';
    const visible = document.layers.filter(l => l.text.trim());
    let detailIndex = 0;
    const layouts = {
      name: { y: centered ? 114 : 83, fontSize: editorial ? 35 : 30, fontWeight: 700 },
      title: { y: centered ? 214 : 190, fontSize: 13, fontWeight: 400 },
      company: { y: centered ? 62 : 91, fontSize: 10, fontWeight: 400, tracking: 1.5 },
    };
    const detailCount = visible.filter(l => !layouts[l.field]).length;
    const columns = detailCount > 5 ? 2 : 1;
    const rows = Math.max(1, Math.ceil(detailCount / columns));
    const detailTop = columns === 2 ? 320 : Math.max(centered ? 335 : 390, 548 - detailCount * 39);
    const step = Math.min(39, (560 - detailTop) / rows);
    return { layers: document.layers.map(layer => {
      const isDetail = !layouts[layer.field];
      const index = detailIndex;
      if (isDetail && layer.text.trim()) detailIndex++;
      const column = columns === 2 ? Math.floor(index / rows) : 0;
      const layout = layouts[layer.field] || { y: detailTop + (index % rows) * step, fontSize: Math.min(10, step / 3.4), fontWeight: 400 };
      const company = layer.field === 'company' && !centered;
      const width = isDetail && columns === 2 ? 420 : centered ? 900 : company ? 320 : 790;
      const size = Math.min(layout.fontSize, layer.text.length > 55 ? 8 : layer.text.length > 32 ? 10 : layout.fontSize);
      const x = isDetail && columns === 2 ? 82 + column * 495 : centered ? 90 : company ? 670 : 82;
      return cleanLayer({ ...layer, ...layout, fontSize: size, x: x * document.width / 1080, y: layout.y * document.height / 600,
        width: width * document.width / 1080, align: centered ? 'center' : company ? 'right' : 'left', color: ink,
        fontFamily: editorial && layer.field === 'name' ? 'serif' : 'sans', tracking: layout.tracking || 0 }, document);
    }), explanation: centered ? '중앙 정렬과 일정한 간격으로 차분하게 정리했어요.' : editorial ? '이름에 명조체를 적용하고 정보의 크기 차이를 정리했어요.' : '이름을 강조하고 연락처의 시작점과 간격을 맞췄어요.' };
  },
};
