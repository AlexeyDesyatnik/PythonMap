// Проверка данных карты: `npm run check:data [каталог карты]`.
// Вся логика проверки — в ядре; здесь только чтение файлов и печать.
import { buildMap, MapDataError, validateMap, type Issue } from '../src/core/index.ts';
import { DEFAULT_MAP_DIR, readMapFiles } from './map-files.ts';

const dir = process.argv[2] ?? DEFAULT_MAP_DIR;

let issues: Issue[];
try {
  issues = validateMap(buildMap(readMapFiles(dir)));
} catch (e) {
  if (!(e instanceof MapDataError)) throw e;
  console.log(`Карту ${dir} не удалось прочитать:\n  ✗ ${e.message}`);
  process.exit(1);
}

const errors = issues.filter((i) => i.severity === 'error');
const warnings = issues.filter((i) => i.severity === 'warning');

if (errors.length > 0) {
  console.log(`Ошибки (${errors.length}) — с ними карту нельзя публиковать:`);
  for (const i of errors) console.log(`  ✗ ${i.message}`);
  console.log();
}
if (warnings.length > 0) {
  console.log(`Предупреждения (${warnings.length}):`);
  for (const i of warnings) console.log(`  ! ${i.message}`);
  console.log();
}

if (errors.length > 0) {
  console.log(`Карта ${dir}: есть ошибки.`);
  process.exit(1);
}
console.log(`Карта ${dir}: ошибок нет${warnings.length > 0 ? `, предупреждений: ${warnings.length}` : ''}.`);
