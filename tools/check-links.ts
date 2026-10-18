// Проверка ссылок карты: `npm run check:links [каталог карты]`.
// Проверяет только, что страницы материалов и контрольных задач открываются;
// соответствие содержания узлу не проверяет.
//
// Ручной запуск печатает результат по каждой ссылке и ничего не меняет; счёт
// неудач подряд он берёт из истории еженедельных проверок.
// Еженедельный запуск (.github/workflows/links.yml) добавляет флаги:
//   --record — сохранить историю неудач в LINK_HISTORY_FILE (только для настоящей карты);
//   --report — завести или обновить задачу в трекере со списком мёртвых ссылок.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { buildMap, MapDataError, type LearningMap } from '../src/core/index.ts';
import { DEAD_AFTER_FAILURES, judgeLinks, type CheckResult, type FailureHistory, type Verdict } from './link-history.ts';
import { DEFAULT_MAP_DIR, readMapFiles } from './map-files.ts';

/** История неудач между запусками; её сохраняет в репозиторий еженедельный запуск. */
const LINK_HISTORY_FILE = 'data/link-failures.json';
const ISSUE_TITLE = 'Мёртвые ссылки на карте';
const ISSUE_LABEL = 'проверка ссылок';
const TIMEOUT_MS = 30_000;
const PARALLEL = 6;

const args = process.argv.slice(2);
const record = args.includes('--record');
const report = args.includes('--report');
const dir = args.find((a) => !a.startsWith('--')) ?? DEFAULT_MAP_DIR;
if (record && dir !== DEFAULT_MAP_DIR) {
  console.log(`История неудач ведётся только для карты ${DEFAULT_MAP_DIR}; флаг --record с другой картой не работает.`);
  process.exit(1);
}

/** Где на карте стоит ссылка — для понятного отчёта. */
interface LinkPlace {
  nodeTitle: string;
  linkTitle: string;
  kind: 'материал' | 'контрольная задача';
}

function collectLinks(map: LearningMap): Map<string, LinkPlace[]> {
  const links = new Map<string, LinkPlace[]>();
  const add = (url: string, place: LinkPlace) => links.set(url, [...(links.get(url) ?? []), place]);
  for (const node of map.nodes) {
    for (const l of node.materials) add(l.url, { nodeTitle: node.title, linkTitle: l.title, kind: 'материал' });
    for (const l of node.checkTasks) {
      add(l.url, { nodeTitle: node.title, linkTitle: l.title, kind: 'контрольная задача' });
    }
  }
  return links;
}

async function checkUrl(url: string): Promise<CheckResult> {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Некоторые сайты не пускают запросы без признаков обычного браузера.
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'ru,en;q=0.8',
      },
    });
    await response.body?.cancel();
    return response.ok ? { url, ok: true } : { url, ok: false, problem: `ответ ${response.status}` };
  } catch (e) {
    const name = e instanceof Error ? e.name : '';
    const problem = name === 'TimeoutError' ? `нет ответа за ${TIMEOUT_MS / 1000} с` : 'сайт недоступен';
    return { url, ok: false, problem };
  }
}

async function checkAll(urls: string[]): Promise<CheckResult[]> {
  const results: CheckResult[] = new Array(urls.length);
  let next = 0;
  const worker = async () => {
    while (next < urls.length) {
      const i = next++;
      results[i] = await checkUrl(urls[i]);
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  return results;
}

function readHistory(): FailureHistory {
  return existsSync(LINK_HISTORY_FILE) ? JSON.parse(readFileSync(LINK_HISTORY_FILE, 'utf8')) : {};
}

function writeHistory(history: FailureHistory) {
  const sorted = Object.fromEntries(Object.entries(history).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(LINK_HISTORY_FILE, JSON.stringify(sorted, null, 2) + '\n');
}

const describePlace = (p: LinkPlace) => `узел «${p.nodeTitle}», ${p.kind} «${p.linkTitle}»`;

function describeVerdict(v: Verdict): string {
  if (v.ok) return 'открывается';
  const count = `неудач подряд: ${v.failuresInRow} из ${DEAD_AFTER_FAILURES}`;
  return `${v.problem}; ${v.dead ? `мёртвая (${count})` : count}`;
}

function gh(...ghArgs: string[]): string {
  return execFileSync('gh', ghArgs, { encoding: 'utf8' }).trim();
}

/** Одна задача в трекере: заводится при первых мёртвых ссылках и дальше обновляется. */
function reportToTracker(dead: Verdict[], links: Map<string, LinkPlace[]>) {
  const open = JSON.parse(
    gh('issue', 'list', '--label', ISSUE_LABEL, '--state', 'open', '--json', 'number,title'),
  ) as { number: number; title: string }[];
  const existing = open.find((i) => i.title === ISSUE_TITLE)?.number;
  const today = new Date().toISOString().slice(0, 10);

  if (dead.length === 0 && existing === undefined) return;

  const lines = dead.flatMap((v) => links.get(v.url)!.map((p) => `- ${describePlace(p)}: ${v.url} — ${v.problem}`));
  const found =
    dead.length === 0
      ? ['Мёртвых ссылок сейчас нет. Если всё исправлено, задачу можно закрыть.']
      : [
          `Проверка нашла ссылки, которые не открылись при ${DEAD_AFTER_FAILURES} или более еженедельных проверках подряд.`,
          'На сайте они по-прежнему показываются. Ссылку нужно заменить или убрать из файла раздела.',
          '',
          ...lines,
        ];
  const body = [
    ...found,
    '',
    `Последняя проверка: ${today}. Пока задача открыта, она обновляется при каждой проверке.`,
  ].join('\n');

  if (existing !== undefined) {
    gh('issue', 'edit', String(existing), '--body', body);
    console.log(`Задача №${existing} обновлена.`);
  } else {
    gh('label', 'create', ISSUE_LABEL, '--force', '--color', 'd93f0b', '--description', 'Отчёт еженедельной проверки ссылок');
    const url = gh('issue', 'create', '--title', ISSUE_TITLE, '--label', ISSUE_LABEL, '--body', body);
    console.log(`Заведена задача: ${url}`);
  }
}

let map: LearningMap;
try {
  map = buildMap(readMapFiles(dir));
} catch (e) {
  if (!(e instanceof MapDataError)) throw e;
  console.log(`Карту ${dir} не удалось прочитать:\n  ✗ ${e.message}`);
  process.exit(1);
}
const links = collectLinks(map);
const urls = [...links.keys()];
console.log(`Карта ${dir}: проверяю ссылок — ${urls.length}.\n`);

const { verdicts, history } = judgeLinks(readHistory(), await checkAll(urls), DEAD_AFTER_FAILURES);

for (const v of verdicts) {
  for (const p of links.get(v.url)!) {
    console.log(`  ${v.ok ? '✓' : v.dead ? '✗' : '!'} ${describePlace(p)}: ${v.url} — ${describeVerdict(v)}`);
  }
}

const failed = verdicts.filter((v) => !v.ok);
const dead = verdicts.filter((v) => v.dead);
console.log(
  `\nНе открылись: ${failed.length} из ${urls.length}, из них мёртвых: ${dead.length}. ` +
    `Мёртвой ссылка считается после ${DEAD_AFTER_FAILURES} неудач подряд в еженедельных проверках.`,
);

if (record) writeHistory(history);
if (report) reportToTracker(dead, links);
