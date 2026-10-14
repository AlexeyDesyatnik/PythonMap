// Карта строится из сырых данных файлов: одного файла на раздел и файла целей.
// Здесь же проверяется форма данных; смысловые проверки (циклы, несуществующие
// узлы и т. п.) — отдельная часть ядра.

export type NodeKind = 'topic' | 'ege-task';

export interface Link {
  title: string;
  url: string;
}

export interface MapNode {
  id: string;
  kind: NodeKind;
  title: string;
  description: string;
  /** Номер задания ЕГЭ — подпись, не связанная с идентификатором. */
  egeNumber?: string;
  prerequisites: string[];
  materials: Link[];
  checkTasks: Link[];
  sectionId: string;
}

export interface Section {
  id: string;
  title: string;
  /** Узлы раздела в порядке автора. */
  nodeIds: string[];
}

export interface Stage {
  id: string;
  title: string;
  targets: string[];
}

export interface Goal {
  id: string;
  title: string;
  /** Ступени в порядке от ближней к дальней. */
  stages: Stage[];
}

export interface LearningMap {
  /** Разделы в порядке автора. */
  sections: Section[];
  /** Все узлы: раздел за разделом, внутри раздела — в порядке автора. */
  nodes: MapNode[];
  goals: Goal[];
}

/** Содержимое одного файла данных и имя файла — для понятных сообщений. */
export interface SourceFile {
  source: string;
  content: unknown;
}

export interface RawMapData {
  /** Файлы разделов в порядке автора. */
  sections: SourceFile[];
  goals: SourceFile;
}

export class MapDataError extends Error {
  constructor(source: string, where: string, problem: string) {
    super(`${source}: ${where ? `${where}: ` : ''}${problem}`);
    this.name = 'MapDataError';
  }
}

const NODE_KINDS: Record<string, NodeKind> = {
  topic: 'topic',
  'ege-task': 'ege-task',
};

export function buildMap(raw: RawMapData): LearningMap {
  const sections: Section[] = [];
  const nodes: MapNode[] = [];

  for (const file of raw.sections) {
    const r = new Reader(file.source);
    const obj = r.object(file.content, '');
    const sectionId = r.string(obj, 'id', '');
    const section: Section = {
      id: sectionId,
      title: r.string(obj, 'title', ''),
      nodeIds: [],
    };
    r.list(obj, 'nodes', '').forEach((item, i) => {
      const node = readNode(r, item, `узел №${i + 1}`, sectionId);
      section.nodeIds.push(node.id);
      nodes.push(node);
    });
    sections.push(section);
  }

  const r = new Reader(raw.goals.source);
  const goalsObj = r.object(raw.goals.content, '');
  const goals = r.list(goalsObj, 'goals', '').map((item, i) => {
    const g = r.object(item, `цель №${i + 1}`);
    const id = r.string(g, 'id', `цель №${i + 1}`);
    return {
      id,
      title: r.string(g, 'title', `цель ${id}`),
      stages: r.list(g, 'stages', `цель ${id}`).map((st, j) => {
        const s = r.object(st, `цель ${id}, ступень №${j + 1}`);
        const stageId = r.string(s, 'id', `цель ${id}, ступень №${j + 1}`);
        const where = `ступень ${stageId}`;
        return {
          id: stageId,
          title: r.string(s, 'title', where),
          targets: r.stringList(s, 'targets', where),
        };
      }),
    };
  });

  return { sections, nodes, goals };
}

function readNode(r: Reader, item: unknown, fallbackWhere: string, sectionId: string): MapNode {
  const n = r.object(item, fallbackWhere);
  const id = r.string(n, 'id', fallbackWhere);
  const where = `узел ${id}`;
  const kindText = r.string(n, 'kind', where);
  const kind = NODE_KINDS[kindText];
  if (!kind) {
    throw r.error(where, `вид «${kindText}» неизвестен; допустимы: ${Object.keys(NODE_KINDS).join(', ')}`);
  }
  const node: MapNode = {
    id,
    kind,
    title: r.string(n, 'title', where),
    description: r.string(n, 'description', where),
    prerequisites: r.stringList(n, 'prerequisites', where),
    materials: r.links(n, 'materials', where),
    checkTasks: r.links(n, 'checkTasks', where),
    sectionId,
  };
  if (kind === 'ege-task') {
    node.egeNumber = r.string(n, 'egeNumber', where);
  } else if (n.egeNumber !== undefined) {
    throw r.error(where, 'номер задания ЕГЭ бывает только у задания ЕГЭ');
  }
  return node;
}

type Obj = Record<string, unknown>;

class Reader {
  constructor(private readonly source: string) {}

  error(where: string, problem: string): MapDataError {
    return new MapDataError(this.source, where, problem);
  }

  object(value: unknown, where: string): Obj {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw this.error(where, 'ожидался набор полей');
    }
    return value as Obj;
  }

  string(obj: Obj, key: string, where: string): string {
    const value = obj[key];
    if (typeof value === 'number') return String(value);
    if (typeof value !== 'string' || value.trim() === '') {
      throw this.error(where, `нет поля «${key}» или оно пустое`);
    }
    return value.trim();
  }

  /** Необязательный список: отсутствующее поле — пустой список. */
  list(obj: Obj, key: string, where: string): unknown[] {
    const value = obj[key];
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) throw this.error(where, `поле «${key}» должно быть списком`);
    return value;
  }

  stringList(obj: Obj, key: string, where: string): string[] {
    return this.list(obj, key, where).map((v) => {
      if (typeof v !== 'string' || v.trim() === '') {
        throw this.error(where, `в списке «${key}» должны быть идентификаторы`);
      }
      return v.trim();
    });
  }

  links(obj: Obj, key: string, where: string): Link[] {
    return this.list(obj, key, where).map((v, i) => {
      const linkWhere = `${where}, ${key} №${i + 1}`;
      const l = this.object(v, linkWhere);
      return { title: this.string(l, 'title', linkWhere), url: this.string(l, 'url', linkWhere) };
    });
  }
}
