import { expect, test, type Page } from '@playwright/test';

const section = (page: Page, id: string) => page.locator(`[data-section="${id}"]`);
const heading = (page: Page) => page.getByTestId('map-heading');
const edges = (page: Page) =>
  page.locator('[data-edge]').evaluateAll((els) => els.map((e) => e.getAttribute('data-edge')).sort());
const back = (page: Page) => page.getByRole('button', { name: '← Обзор' });

test('обзор показывает разделы с числом тем и стрелки между ними', async ({ page }) => {
  await page.goto('./');

  await expect(heading(page)).toHaveText('Обзор: разделы карты');
  await expect(section(page, 'alpha')).toContainText('Раздел Альфа');
  await expect(section(page, 'alpha')).toContainText('2 темы');
  await expect(section(page, 'beta')).toContainText('1 тема');
  await expect(section(page, 'gamma')).toContainText('1 задание');
  // Узлов на обзоре нет — только разделы.
  await expect(page.locator('[data-node]')).toHaveCount(0);
  expect(await edges(page)).toEqual(['alpha->beta', 'beta->gamma']);

  // Обзор читается снизу вверх: от основ к заданиям.
  const y = async (id: string) => (await section(page, id).boundingBox())!.y;
  expect(await y('alpha')).toBeGreaterThan(await y('beta'));
  expect(await y('beta')).toBeGreaterThan(await y('gamma'));
});

test('щелчок по разделу открывает граф его тем, возврат к обзору — одной кнопкой', async ({ page }) => {
  await page.goto('./');

  await section(page, 'beta').click();
  await expect(heading(page)).toHaveText('Раздел Бета');
  await expect(page.locator('[data-node="b1"]')).toHaveText('Тема Б1');
  await expect(page.locator('[data-node]')).toHaveCount(1);
  // Темы Альфы показаны одним блоком, из которого идёт стрелка.
  const block = page.locator('[data-block="alpha"]');
  await expect(block).toContainText('Раздел Альфа');
  await expect(block).toContainText('Тема А1');
  await expect(block).toContainText('Тема А2');
  expect(await edges(page)).toEqual(['section:alpha->b1']);
  // Описания тем раздела видны сразу.
  await expect(page.getByRole('region', { name: 'Узлы раздела' })).toContainText(
    'Тема, опирающаяся на обе темы Альфы.',
  );

  // Щелчок по блоку переводит в раздел-источник.
  await block.click();
  await expect(heading(page)).toHaveText('Раздел Альфа');
  await expect(page.locator('[data-node]')).toHaveText(['Тема А1', 'Тема А2']);
  expect(await edges(page)).toEqual(['a1->a2']);

  await back(page).click();
  await expect(heading(page)).toHaveText('Обзор: разделы карты');
  await expect(section(page, 'alpha')).toBeVisible();
  await expect(page.locator('[data-node]')).toHaveCount(0);
});

test('раздел заданий ЕГЭ показан рядами по ступеням, у задания видно, на какие разделы оно опирается', async ({
  page,
}) => {
  await page.goto('./');
  await section(page, 'gamma').click();

  await expect(page.locator('.task-row-title')).toHaveText(['Ступень 2']);
  await expect(page.locator('[data-node="exam-1"]')).toContainText('7. Учебное задание');
  await expect(page.locator('[data-node="exam-1"]')).toContainText('Опирается на: Раздел Бета');
});

test('карту можно перетаскивать и масштабировать, а перетаскивание не открывает узел', async ({ page }) => {
  await page.goto('./');
  await section(page, 'alpha').click();
  const a1 = page.locator('[data-node="a1"]');
  const before = (await a1.boundingBox())!;

  // Перетаскивание за узел сдвигает карту, но не открывает его.
  await page.mouse.move(before.x + 20, before.y + 20);
  await page.mouse.down();
  await page.mouse.move(before.x + 80, before.y - 40, { steps: 5 });
  await page.mouse.up();
  const moved = (await a1.boundingBox())!;
  expect(moved.x - before.x).toBeCloseTo(60, 0);
  expect(moved.y - before.y).toBeCloseTo(-60, 0);
  await expect(page.getByRole('region', { name: 'Узел' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Крупнее' }).click();
  expect((await a1.boundingBox())!.width).toBeGreaterThan(moved.width);
  await page.getByRole('button', { name: 'Мельче' }).click();
  await page.getByRole('button', { name: 'Мельче' }).click();
  expect((await a1.boundingBox())!.width).toBeLessThan(moved.width);

  // Колесо мыши тоже масштабирует.
  const small = (await a1.boundingBox())!.width;
  await page.mouse.move(before.x, before.y);
  await page.mouse.wheel(0, -300);
  await expect.poll(async () => (await a1.boundingBox())!.width).toBeGreaterThan(small);

  // Обычный щелчок по узлу открывает его.
  await a1.click();
  await expect(page.getByRole('region', { name: 'Узел' })).toContainText('Тема А1');
});
