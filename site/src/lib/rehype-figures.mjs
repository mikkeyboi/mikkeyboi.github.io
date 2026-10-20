/**
 * A paragraph holding only an image becomes a numbered figure. The Markdown alt text is the
 * caption; a title, when given, becomes the image's alt text (the caption is often too long for one).
 */
export default function rehypeFigures() {
  return (tree) => {
    let n = 0;
    const visit = (node) => {
      if (!node.children) return;
      node.children = node.children.map((child) => {
        if (child.type !== 'element' || child.tagName !== 'p') return (visit(child), child);
        const kids = child.children.filter((c) => !(c.type === 'text' && !c.value.trim()));
        const img = kids[0];
        if (kids.length !== 1 || img.type !== 'element' || img.tagName !== 'img') return child;
        const caption = String(img.properties.alt ?? '');
        if (!caption) return child;
        n += 1;
        if (img.properties.title) {
          img.properties.alt = img.properties.title;
          delete img.properties.title;
        }
        return {
          type: 'element',
          tagName: 'figure',
          properties: { className: ['figure'], id: `fig-${n}` },
          children: [
            img,
            {
              type: 'element',
              tagName: 'figcaption',
              properties: {},
              children: [
                { type: 'element', tagName: 'span', properties: { className: ['fig-n'] }, children: [{ type: 'text', value: `Fig. ${n}` }] },
                { type: 'text', value: caption },
              ],
            },
          ],
        };
      });
    };
    visit(tree);
  };
}
