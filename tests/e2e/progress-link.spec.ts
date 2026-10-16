import { expect, test, type Page } from '@playwright/test';
import { node } from './helpers';

const question = (page: Page) => page.getByRole('alertdialog', { name: /другой прогресс/ });

async function expectMastered(page: Page, mastered: string[], notMastered: string[]) {
  for (const id of mastered) await expect(await node(page, id)).toHaveAttribute('data-mastered', 'true');
  for (const id of notMastered) await expect(await node(page, id)).toHaveAttribute('data-mastered', 'false');
}

/** Прогресс, который уже лежит в браузере до первого открытия страницы. */
async function seedProgress(page: Page, ids: string[]) {
  await page.addInitScript((ids) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('python-map/progress', JSON.stringify(ids));
      sessionStorage.setItem('seeded', '1');
    }
  }, ids);
}

test('ссылка с прогрессом получается одним действием и несёт только верхние освоенные узлы', async ({ page }) => {
  await seedProgress(page, ['a1', 'a2', 'd1']);
  await page.goto('/');

  await page.getByRole('button', { name: 'Ссылка с прогрессом' }).click();
  const link = page.getByRole('textbox', { name: 'Ссылка с прогрессом' });
  await expect(link).toHaveValue(/\/#progress=a2,d1$/);
});

test('ссылка в браузере без прогресса применяется сразу, остальное восстанавливается каскадом', async ({ page }) => {
  // Узла removed на карте нет — он отбрасывается молча.
  await page.goto('/#progress=b1,removed');

  await expect(question(page)).toHaveCount(0);
  await expectMastered(page, ['a1', 'a2', 'b1'], ['exam-1', 'd1']);
  // Ссылка обработана: адрес очищен, перезагрузка ничего не спрашивает и прогресс сохраняет.
  expect(new URL(page.url()).hash).toBe('');
  await page.reload();
  await expect(question(page)).toHaveCount(0);
  await expectMastered(page, ['a1', 'a2', 'b1'], ['exam-1', 'd1']);
});

test('ссылка без узлов текущей карты ничего не спрашивает и прогресс не трогает', async ({ page }) => {
  await seedProgress(page, ['d1']);
  await page.goto('/#progress=removed');

  await expect(page.locator('[data-open-section]')).toBeVisible();
  await expect(question(page)).toHaveCount(0);
  expect(new URL(page.url()).hash).toBe('');
  await expectMastered(page, ['d1'], ['a1']);
});

for (const [answer, mastered, notMastered] of [
  ['Заменить', ['a1', 'a2'], ['d1', 'b1']],
  ['Объединить', ['a1', 'a2', 'd1'], ['b1']],
  ['Отменить', ['d1'], ['a1', 'a2', 'b1']],
] as const) {
  test(`ссылка при уже имеющемся прогрессе: «${answer}»`, async ({ page }) => {
    await seedProgress(page, ['d1']);
    await page.goto('/#progress=a2');

    // Пока ученик не ответил, ничего не меняется — даже после перезагрузки.
    await expect(question(page)).toBeVisible();
    await page.reload();
    await expect(question(page)).toBeVisible();
    // Карта под вопросом закрыта, поэтому смотрим прямо в сохранённый прогресс.
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('python-map/progress')!))).toEqual(['d1']);

    await question(page).getByRole('button', { name: answer }).click();
    await expect(question(page)).toHaveCount(0);
    await expectMastered(page, [...mastered], [...notMastered]);

    // Ответ получен: перезагрузка не задаёт вопрос повторно.
    await page.reload();
    await expect(question(page)).toHaveCount(0);
    await expectMastered(page, [...mastered], [...notMastered]);
  });
}
