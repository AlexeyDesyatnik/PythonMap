// Проверка данных карты: `npm run check:data [каталог карты]`.
// Вся логика проверки — в ядре; здесь только чтение файлов и печать.
import { buildMap, MapDataError, validateMap, type Issue } from '../src/core/index.ts';
import { DEFAULT_MAP_DIR, readMapFiles } from './map-files.ts';

const dir = process.argv[2] ?? DEFAULT_MAP_DIR;

// В GitHub Actions ошибки и предупреждения ещё и выносятся отдельными пометками
// на страницу запуска, чтобы их было видно, не открывая журнал.
const inActions = process.env.GITHUB_ACTIONS === 'true';
const annotate = (kind: 'error' | 'warning', message: string) => {
  if (!inActions) return;
  // Перевод строки и % в тексте пометки GitHub требует записывать кодами.
  const text = message.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  console.log(`::${kind} title=Проверка данных карты::${text}`);
};

let issues: Issue[];
try {
  issues = validateMap(buildMap(readMapFiles(dir)));
} catch (e) {
  if (!(e instanceof MapDataError)) throw e;
  console.log(`Карту ${dir} не удалось прочитать:\n  ✗ ${e.message}`);
  annotate('error', e.message);
  process.exit(1);
}

const errors = issues.filter((i) => i.severity === 'error');
const warnings = issues.filter((i) => i.severity === 'warning');

if (errors.length > 0) {
  console.log(`Ошибки (${errors.length}) — с ними карту нельзя публиковать:`);
  for (const i of errors) {
    console.log(`  ✗ ${i.message}`);
    annotate('error', i.message);
  }
  console.log();
}
if (warnings.length > 0) {
  console.log(`Предупреждения (${warnings.length}):`);
  for (const i of warnings) {
    console.log(`  ! ${i.message}`);
    annotate('warning', i.message);
  }
  console.log();
}

if (errors.length > 0) {
  console.log(`Карта ${dir}: есть ошибки.`);
  process.exit(1);
}
console.log(`Карта ${dir}: ошибок нет${warnings.length > 0 ? `, предупреждений: ${warnings.length}` : ''}.`);
