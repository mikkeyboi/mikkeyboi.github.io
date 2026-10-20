import './sims.css';
/**
 * Mount every simulation placeholder under `root`. Placeholders are `<div data-sim="...">` from the
 * sim components; widget code loads only when a page (or a quick view) actually holds one.
 */
export async function mountSims(root: ParentNode = document): Promise<void> {
  const nodes = [...root.querySelectorAll<HTMLElement>('[data-sim]:not([data-mounted])')];
  await Promise.all(nodes.map(async (node) => {
    node.dataset.mounted = 'true';
    const props = node.dataset.props ? JSON.parse(node.dataset.props) : {};
    if (node.dataset.sim === 'refusal-toy') {
      const { RefusalToy } = await import('./refusal/toy');
      new RefusalToy(node, props);
    } else if (node.dataset.sim === 'refusal-evidence') {
      const { RefusalEvidence } = await import('./refusal/evidence');
      new RefusalEvidence(node, props.metrics);
    }
  }));
}
