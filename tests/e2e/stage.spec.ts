import { expect, test, type Page } from '@playwright/test';
import { node, toOverview } from './helpers';

const goal = (page: Page) => page.getByRole('combobox', { name: 'Цель' });
const stage = (page: Page) => page.getByRole('combobox', { name: 'Ступень' });
const total = (page: Page) => page.getByTestId('progress-total');
/** Счёт раздела виден на обзоре. */
async function sectionCount(page: Page, id: string) {
  await toOverview(page);
  return page.locator(`[data-section-count="${id}"]`);
}
const masteredBox = (page: Page) =>
  page.getByRole('region', { name: 'Узел' }).getByRole('checkbox', { name: 'Освоен' });

async function expectViews(page: Page, views: Record<string, string>) {
  for (const [id, view] of Object.entries(views)) await expect(await node(page, id)).toHaveAttribute('data-view', view);
}

async function mark(page: Page, id: string) {
  await (await node(page, id)).click();
  await masteredBox(page).check();
}

test('пока ступень не выбрана, вне ступени нет ни одного узла, а счёт идёт по всей карте', async ({ page }) => {
  await page.goto('/');

  await expect(goal(page)).toHaveValue('');
  await expect(stage(page)).toBeDisabled();
  await expectViews(page, { a1: 'available', a2: 'ahead', b1: 'ahead', 'exam-1': 'ahead' });
  await expect(total(page)).toHaveText('Освоено 0 из 5');
});

test('выбор ступени делит узлы на виды и считает освоенное в ступени и по разделам', async ({ page }) => {
  await page.goto('/');

  await goal(page).selectOption({ label: 'Экзамен' });
  // Ступень ученик выбирает сам; пока она не выбрана, вне ступени нет никого.
  await expect(stage(page)).toBeEnabled();
  await expect(stage(page)).toHaveValue('');
  await expectViews(page, { b1: 'ahead', 'exam-1': 'ahead' });
  await expect(total(page)).toHaveText('Освоено 0 из 5');

  await stage(page).selectOption({ label: 'Ступень 1' });
  await expectViews(page, { a1: 'available', a2: 'ahead', b1: 'outside', 'exam-1': 'outside' });
  await expect(total(page)).toHaveText('Освоено 0 из 2');
  await expect(await sectionCount(page, 'alpha')).toHaveText('0 из 2');
  await expect(await sectionCount(page, 'beta')).toHaveCount(0);

  // Отметка сразу меняет виды и счёт.
  await mark(page, 'a1');
  await expectViews(page, { a1: 'mastered', a2: 'available', b1: 'outside' });
  await expect(total(page)).toHaveText('Освоено 1 из 2');
  await expect(await sectionCount(page, 'alpha')).toHaveText('1 из 2');

  // Следующая ступень включает предыдущую.
  await stage(page).selectOption({ label: 'Ступень 2' });
  await expectViews(page, { a1: 'mastered', a2: 'available', b1: 'ahead', 'exam-1': 'ahead' });
  await expect(total(page)).toHaveText('Освоено 1 из 4');
  await expect(await sectionCount(page, 'beta')).toHaveText('0 из 1');
  await expect(await sectionCount(page, 'gamma')).toHaveText('0 из 1');

  // Снятие отметки тоже обновляет всё сразу.
  await (await node(page, 'a1')).click();
  await masteredBox(page).uncheck();
  await expectViews(page, { a1: 'available', a2: 'ahead' });
  await expect(total(page)).toHaveText('Освоено 0 из 4');
});

test('смена цели не меняет прогресс, а выбранная ступень переживает перезагрузку', async ({ page }) => {
  await page.goto('/');
  await mark(page, 'a2');

  await goal(page).selectOption({ label: 'Экзамен' });
  await stage(page).selectOption({ label: 'Ступень 2' });
  // Смена цели сбрасывает ступень.
  await goal(page).selectOption({ label: 'Олимпиада' });
  await expect(stage(page)).toHaveValue('');
  await stage(page).selectOption({ label: 'Первый этап' });
  // Освоенный узел вне ступени всё равно виден освоенным.
  await expectViews(page, { a1: 'mastered', a2: 'mastered', b1: 'outside' });
  await expect(total(page)).toHaveText('Освоено 1 из 1');

  await page.reload();
  await expect(goal(page)).toHaveValue('olymp');
  await expect(stage(page)).toHaveValue('olymp-1');
  await expectViews(page, { a1: 'mastered', a2: 'mastered', b1: 'outside' });

  // Ступень можно и сбросить.
  await goal(page).selectOption({ label: 'Не выбрана' });
  await expectViews(page, { b1: 'available' });
  await page.reload();
  await expect(goal(page)).toHaveValue('');
});

test('сохранённая ступень, которой больше нет на карте, молча забывается', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('python-map/stage', JSON.stringify({ goalId: 'exam', stageId: 'removed' }));
  });
  await page.goto('/');

  await expect(goal(page)).toHaveValue('');
  await expectViews(page, { b1: 'ahead' });
});
