import { expect, test, type Page } from '@playwright/test';
import { node } from './helpers';

const panel = (page: Page) => page.getByRole('region', { name: 'Узел' });
const prerequisites = (page: Page) => panel(page).getByRole('list', { name: 'Пререквизиты' });
const unlocks = (page: Page) => panel(page).getByRole('list', { name: 'Открывает' });

test('панель показывает описание, материалы и контрольные задачи; ссылки открываются в новой вкладке', async ({
  page,
}) => {
  await page.goto('./');
  await (await node(page, 'a1')).click();

  await expect(panel(page)).toContainText('Тема А1');
  await expect(panel(page)).toContainText('Первая тема.');
  const material = panel(page).getByRole('link', { name: 'Учебник по А1' });
  await expect(material).toHaveAttribute('href', 'https://example.org/a1-book');
  await expect(material).toHaveAttribute('target', '_blank');
  const task = panel(page).getByRole('link', { name: 'Задача по А1' });
  await expect(task).toHaveAttribute('href', 'https://example.org/a1-task');
  await expect(task).toHaveAttribute('target', '_blank');
  await expect(panel(page)).toContainText('Реши их сам — и отмечай узел освоенным');
  await expect(panel(page)).not.toContainText('Материалы появятся');
});

test('у узла без материалов и задач — пометка «материалы появятся»; у задания ЕГЭ виден номер', async ({ page }) => {
  await page.goto('./');
  await (await node(page, 'a2')).click();
  await expect(panel(page)).toContainText('Материалы появятся');
  await expect(panel(page).getByRole('link', { name: /Учебник/ })).toHaveCount(0);

  await (await node(page, 'exam-1')).click();
  await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText('7. Учебное задание');
  await expect(panel(page)).toContainText('Задание экзамена.');
});

test('панель показывает пререквизиты и открываемые узлы с отметками; по ним можно переходить', async ({ page }) => {
  await page.goto('./');
  await (await node(page, 'a2')).click();
  await panel(page).getByRole('checkbox', { name: 'Освоен' }).check();

  await (await node(page, 'a1')).click();
  await expect(panel(page)).toContainText('Нет: с этого узла можно начинать');
  await expect(unlocks(page).getByRole('listitem')).toHaveText([/Тема А2/, /Тема Б1/]);
  await expect(unlocks(page).getByRole('listitem').nth(0)).toHaveAttribute('data-mastered', 'true');
  await expect(unlocks(page).getByRole('listitem').nth(1)).toHaveAttribute('data-mastered', 'false');

  // Переход в узел другого раздела: открываются и он, и его раздел.
  await unlocks(page).getByRole('button', { name: /Тема Б1/ }).click();
  await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText('Тема Б1');
  await expect(page.locator('[data-node="b1"]')).toBeVisible();
  await expect(prerequisites(page).getByRole('listitem')).toHaveText([/Тема А1/, /Тема А2/]);
  await expect(prerequisites(page).getByRole('listitem').nth(1)).toHaveAttribute('data-mastered', 'true');
  await expect(unlocks(page).getByRole('listitem')).toHaveText([/7\. Учебное задание/]);

  await prerequisites(page).getByRole('button', { name: /Тема А2/ }).click();
  await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText('Тема А2');
});

test('ссылка «сообщить об ошибке» ведёт в канал и подставляет название узла', async ({ page }) => {
  await page.goto('./');
  await (await node(page, 'exam-1')).click();

  const report = panel(page).getByRole('link', { name: 'Сообщить об ошибке' });
  await expect(report).toHaveAttribute(
    'href',
    `https://example.org/report?node=${encodeURIComponent('7. Учебное задание')}`,
  );
  await expect(report).toHaveAttribute('target', '_blank');
});
