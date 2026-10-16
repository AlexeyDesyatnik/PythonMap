import { expect, test, type Page } from '@playwright/test';

// Телефон: узкий экран и касания вместо мыши.
test.use({ viewport: { width: 375, height: 740 }, hasTouch: true, isMobile: true });

const routePanel = (page: Page) => page.getByRole('region', { name: 'Маршрут' });
const sectionList = (page: Page) => page.getByRole('list', { name: 'Разделы карты' });
const nodePanel = (page: Page) => page.getByRole('region', { name: 'Узел' });

async function chooseStage(page: Page) {
  await page.getByRole('combobox', { name: 'Цель' }).selectOption({ label: 'Экзамен' });
  await page.getByRole('combobox', { name: 'Ступень' }).selectOption({ label: 'Ступень 2' });
}

/** Страница не шире экрана: прокручивать её вбок не нужно. */
async function expectNoHorizontalScroll(page: Page) {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(client);
}

/** Касание пальцем: опустить, провести по точкам и поднять — как настоящий жест на телефоне. */
async function touch(page: Page, points: { x: number; y: number }[]) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type: 'touchStart' | 'touchMove' | 'touchEnd', p?: { x: number; y: number }) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [p] : [] });
  await send('touchStart', points[0]);
  for (const p of points.slice(1)) await send('touchMove', p);
  await send('touchEnd');
  await cdp.detach();
}

const centre = async (page: Page, selector: string) => {
  const b = (await page.locator(selector).boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

test('на телефоне узел открывается с первого касания, даже если перед этим граф двигали', async ({ page }) => {
  await page.goto('/');
  await sectionList(page).getByRole('button', { name: /Раздел Альфа/ }).tap();

  // Граф сдвинули пальцем вбок и отпустили.
  const start = await centre(page, '[data-node="a1"]');
  await touch(page, [start, { x: start.x + 20, y: start.y }, { x: start.x + 40, y: start.y }]);
  await expect(nodePanel(page)).toHaveCount(0);
  // Пауза, как у живого человека: касание вплотную за жестом браузер щелчком не считает.
  await page.waitForTimeout(400);

  // Первое же касание узла открывает его.
  await touch(page, [await centre(page, '[data-node="a1"]')]);
  await expect(nodePanel(page)).toContainText('Тема А1');
});

test('на телефоне палец, чуть дрогнувший при касании, всё равно открывает узел', async ({ page }) => {
  await page.goto('/');
  await sectionList(page).getByRole('button', { name: /Раздел Альфа/ }).tap();

  const { x, y } = await centre(page, '[data-node="a2"]');
  await touch(page, [{ x, y }, { x: x + 3, y: y + 2 }, { x: x + 6, y: y + 3 }]);
  await expect(nodePanel(page)).toContainText('Тема А2');
});

test('на телефоне первым идёт маршрут, а вместо обзора — список разделов со счётом', async ({ page }) => {
  await page.goto('/');
  await chooseStage(page);

  // Маршрут со следующим шагом виден сразу, без прокрутки.
  const next = routePanel(page).getByRole('listitem').first();
  await expect(next).toContainText('Следующий шаг');
  await expect(next).toContainText('Тема А1');
  await expect(next).toBeInViewport();

  // Вместо графа обзора — список разделов от основ к заданиям ЕГЭ.
  await expect(page.locator('svg [data-section]')).toHaveCount(0);
  const items = sectionList(page).getByRole('listitem');
  await expect(items).toHaveText([/Раздел Альфа/, /Раздел Бета/, /Раздел Задания/, /Раздел Дельта/]);
  await expect(items.nth(0)).toContainText('освоено 0 из 2');
  await expect(items.nth(0)).toContainText('2 шага маршрута');

  await expectNoHorizontalScroll(page);
});

test('на телефоне раздел открывается из списка, узел открывается и отмечается', async ({ page }) => {
  await page.goto('/');
  await chooseStage(page);

  await sectionList(page).getByRole('button', { name: /Раздел Альфа/ }).tap();
  await expect(page.getByTestId('map-heading')).toHaveText('Раздел Альфа');

  // Маленький граф раздела помещается в ширину экрана; большой прокручивается вбок в своей рамке.
  const a1 = page.locator('[data-node="a1"]');
  const box = (await a1.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(375);
  await expectNoHorizontalScroll(page);

  await a1.tap();
  await expect(nodePanel(page)).toContainText('Тема А1');
  await expect(nodePanel(page)).toBeInViewport();
  // Закрывать панель крестиком на телефоне не нужно: она закрывается сама.
  await expect(nodePanel(page).getByRole('button', { name: 'Закрыть' })).toHaveCount(0);
  await nodePanel(page).getByRole('checkbox', { name: 'Освоен' }).tap();
  await expect(a1).toHaveAttribute('data-mastered', 'true');
  await expect(page.getByTestId('progress-total')).toHaveText('Освоено 1 из 4');
  // После отметки панель сразу убирается и не закрывает карту.
  await expect(nodePanel(page)).toHaveCount(0);
  await expectNoHorizontalScroll(page);

  // Снятие отметки тоже сразу убирает панель.
  await a1.tap();
  await nodePanel(page).getByRole('checkbox', { name: 'Освоен' }).tap();
  await expect(a1).toHaveAttribute('data-mastered', 'false');
  await expect(nodePanel(page)).toHaveCount(0);
  await a1.tap();
  await nodePanel(page).getByRole('checkbox', { name: 'Освоен' }).tap();

  // Назад к списку разделов: счёт в нём обновился.
  await page.getByRole('button', { name: '← Обзор' }).tap();
  await expect(sectionList(page).getByRole('listitem').first()).toContainText('освоено 1 из 2');
});

test('на телефоне шаг маршрута открывает узел вместе с его разделом', async ({ page }) => {
  await page.goto('/');
  await chooseStage(page);

  await routePanel(page).getByRole('button', { name: /Тема Б1/ }).tap();
  await expect(nodePanel(page)).toContainText('Тема Б1');
  await expect(nodePanel(page)).toBeInViewport();
  await expect(page.getByTestId('map-heading')).toHaveText('Раздел Бета');
  await expectNoHorizontalScroll(page);

  // Переход в другой раздел убирает панель узла.
  await page.locator('[data-block="alpha"]').tap();
  await expect(page.getByTestId('map-heading')).toHaveText('Раздел Альфа');
  await expect(nodePanel(page)).toHaveCount(0);

  // И возврат к обзору тоже.
  await page.locator('[data-node="a1"]').tap();
  await expect(nodePanel(page)).toContainText('Тема А1');
  await page.getByRole('button', { name: '← Обзор' }).tap();
  await expect(nodePanel(page)).toHaveCount(0);
});
