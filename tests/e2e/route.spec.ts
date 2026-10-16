import { expect, test, type Page } from '@playwright/test';
import { node, routeOnMap, toOverview } from './helpers';

const goal = (page: Page) => page.getByRole('combobox', { name: 'Цель' });
const stage = (page: Page) => page.getByRole('combobox', { name: 'Ступень' });
const routePanel = (page: Page) => page.getByRole('region', { name: 'Маршрут' });
const routeItems = (page: Page) => routePanel(page).getByRole('listitem');
const nodePanel = (page: Page) => page.getByRole('region', { name: 'Узел' });
const masteredBox = (page: Page) => nodePanel(page).getByRole('checkbox', { name: 'Освоен' });

async function chooseStage(page: Page, goalTitle: string, stageTitle: string) {
  await goal(page).selectOption({ label: goalTitle });
  await stage(page).selectOption({ label: stageTitle });
}

test('пока ступень не выбрана, панель маршрута предлагает её выбрать', async ({ page }) => {
  await page.goto('./');

  await expect(routePanel(page)).toContainText('Выберите цель и ступень');
  await expect(routeItems(page)).toHaveCount(0);
  expect(await routeOnMap(page)).toEqual([]);

  // Цель без ступени — маршрута ещё нет.
  await goal(page).selectOption({ label: 'Экзамен' });
  await expect(routePanel(page)).toContainText('Выберите');
  await expect(routeItems(page)).toHaveCount(0);
});

test('маршрут идёт по порядку, выделен на карте и открывает узлы', async ({ page }) => {
  await page.goto('./');
  await chooseStage(page, 'Экзамен', 'Ступень 2');

  await expect(routeItems(page)).toHaveText([/Тема А1/, /Тема А2/, /Тема Б1/, /7\. Учебное задание/]);
  await expect(routeItems(page).first()).toContainText('Следующий шаг');
  await expect(routeItems(page).nth(1)).not.toContainText('Следующий шаг');
  expect(await routeOnMap(page)).toEqual(['a1', 'a2', 'b1', 'exam-1']);

  // На обзоре видно, через какие разделы идёт маршрут и сколько в каждом шагов.
  await toOverview(page);
  for (const [id, steps] of [['alpha', '2'], ['beta', '1'], ['gamma', '1']]) {
    await expect(page.locator(`[data-section="${id}"]`)).toHaveAttribute('data-route-steps', steps);
  }

  // Шаг маршрута открывает узел вместе с его разделом.
  await routePanel(page).getByRole('button', { name: /Тема Б1/ }).click();
  await expect(nodePanel(page)).toContainText('Тема Б1');
  await expect(page.getByTestId('map-heading')).toHaveText('Раздел Бета');
  await expect(page.locator('[data-node="b1"]')).toHaveAttribute('aria-pressed', 'true');
});

test('маршрут пересчитывается после отметки, снятия отметки и смены ступени', async ({ page }) => {
  await page.goto('./');
  await chooseStage(page, 'Экзамен', 'Ступень 2');

  // Отметка вне очереди: каскад освоил и пререквизиты Б1.
  await (await node(page, 'b1')).click();
  await masteredBox(page).check();
  await expect(routeItems(page)).toHaveText([/Следующий шаг.*7\. Учебное задание/]);
  expect(await routeOnMap(page)).toEqual(['exam-1']);

  // Снятие отметки с А2 снимает её и с Б1 — они возвращаются в маршрут.
  await (await node(page, 'a2')).click();
  await masteredBox(page).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Снять отметку' }).click();
  await expect(routeItems(page)).toHaveText([/Тема А2/, /Тема Б1/, /7\. Учебное задание/]);

  await stage(page).selectOption({ label: 'Ступень 1' });
  await expect(routeItems(page)).toHaveText([/Тема А2/]);
  expect(await routeOnMap(page)).toEqual(['a2']);
});

test('когда все узлы ступени освоены, панель сообщает, что ступень достигнута', async ({ page }) => {
  await page.goto('./');
  await chooseStage(page, 'Экзамен', 'Ступень 1');

  await (await node(page, 'a2')).click();
  await masteredBox(page).check();

  await expect(routePanel(page)).toContainText('Ступень достигнута');
  await expect(routePanel(page)).toContainText('«Ступень 2»');
  await expect(routeItems(page)).toHaveCount(0);
  expect(await routeOnMap(page)).toEqual([]);

  // У последней ступени цели следующей нет — и предлагать нечего.
  await stage(page).selectOption({ label: 'Ступень 2' });
  await (await node(page, 'exam-1')).click();
  await masteredBox(page).check();
  await expect(routePanel(page)).toContainText('Ступень достигнута');
  await expect(routePanel(page)).not.toContainText('следующую');
});

test('темы из других разделов в блоке показывают отметку и шаг маршрута', async ({ page }) => {
  await page.goto('./');
  await chooseStage(page, 'Экзамен', 'Ступень 2');
  await (await node(page, 'a1')).click();
  await masteredBox(page).check();

  await toOverview(page);
  await page.locator('[data-section="beta"]').click();
  const block = page.locator('[data-block="alpha"]');
  await expect(block).toContainText('Тема А1 ✓');
  await expect(block).toContainText('Тема А2 (шаг 1)');
});
