import type { LearningMap } from '../core';
import { nodeLabel } from './labels';

interface Props {
  map: LearningMap;
  sectionId: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** Узлы открытого раздела с описаниями — чтобы читать их, не открывая каждый узел. */
export function SectionNodes({ map, sectionId, selectedId, onSelect }: Props) {
  const section = map.sections.find((s) => s.id === sectionId)!;
  const nodes = section.nodeIds.map((id) => map.nodes.find((n) => n.id === id)!);
  return (
    <section className="section-topics" aria-label="Узлы раздела">
      <h2 className="section-topics-title">{section.title}</h2>
      <ul className="section-topics-list">
        {nodes.map((node) => (
          <li key={node.id}>
            <button
              type="button"
              className="section-topic"
              aria-pressed={node.id === selectedId}
              onClick={() => onSelect(node.id)}
            >
              <span className="section-topic-name">{nodeLabel(node)}</span>
              <span className="section-topic-description">{node.description}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
