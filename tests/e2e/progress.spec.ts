import { expect, test, type Page } from '@playwright/test';

const node = (page: Page, id: string) => page.locator(`[data-node="${id}"]`);
const panel = (page: Page) => page.getByRole('region', { name: 'Узел' });
const masteredBox = (page: Page) => panel(page).getByRole('checkbox', { name: 'Освоен' });

async function expectMastered(page: Page, mastered: string[], notMastered: string[]) {
  for (const id of mastered) await expect(node(page, id)).toHaveAttribute('data-mastered', 'true');
  for (const id of notMastered) await expect(node(page, id)).toHaveAttribute('data-mastered', 'false');
}

test('отметка узла отмечает его пререквизиты и сохраняется после перезагрузки', async ({ page }) => {
  await page.goto('/');

  await node(page, 'a2').click();
  await expect(panel(page)).toContainText('Тема А2');
  await expect(masteredBox(page)).not.toBeChecked();

  await masteredBox(page).check();
  await expectMastered(page, ['a1', 'a2'], ['b1', 'exam-1']);

  await page.reload();
  await expectMastered(page, ['a1', 'a2'], ['b1', 'exam-1']);
});

test('перед снятием отметки предупреждает об опирающихся узлах; от снятия можно отказаться', async ({ page }) => {
  await page.goto('/');
  // Отметить можно любой узел: задание отмечается сразу, без своих пререквизитов.
  await node(page, 'exam-1').click();
  await masteredBox(page).check();
  await expectMastered(page, ['a1', 'a2', 'b1', 'exam-1'], []);

  await node(page, 'a2').click();
  // Флажок не снимается сразу: сначала ученик отвечает на предупреждение.
  await masteredBox(page).click();
  const warning = page.getByRole('alertdialog');
  await expect(warning).toContainText('Тема Б1');
  await expect(warning).toContainText('7. Учебное задание');
  await expect(warning).not.toContainText('Тема А1');

  await warning.getByRole('button', { name: 'Отмена' }).click();
  await expect(warning).toBeHidden();
  await expect(masteredBox(page)).toBeChecked();
  await expectMastered(page, ['a1', 'a2', 'b1', 'exam-1'], []);

  await masteredBox(page).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Снять отметку' }).click();
  await expectMastered(page, ['a1'], ['a2', 'b1', 'exam-1']);

  await page.reload();
  await expectMastered(page, ['a1'], ['a2', 'b1', 'exam-1']);
});

test('отметка без опирающихся освоенных узлов снимается без предупреждения', async ({ page }) => {
  await page.goto('/');
  await node(page, 'a2').click();
  await masteredBox(page).check();

  await masteredBox(page).uncheck();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expectMastered(page, ['a1'], ['a2']);
});

test('сохранённый прогресс приводится к инварианту при загрузке', async ({ page }) => {
  // Узла removed больше нет на карте, а у b1 не отмечены пререквизиты.
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('python-map/progress', JSON.stringify(['removed', 'b1']));
      sessionStorage.setItem('seeded', '1');
    }
  });
  await page.goto('/');

  await expectMastered(page, ['a1', 'a2', 'b1'], ['exam-1']);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('python-map/progress')!));
  expect(stored.sort()).toEqual(['a1', 'a2', 'b1']);
});
