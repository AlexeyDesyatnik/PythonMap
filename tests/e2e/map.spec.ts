import { expect, test } from '@playwright/test';

test('страница показывает узлы карты по разделам и стрелки пререквизитов', async ({ page }) => {
  await page.goto('/');

  const alpha = page.locator('[data-section="alpha"]');
  const beta = page.locator('[data-section="beta"]');
  await expect(alpha).toContainText('Раздел Альфа');
  await expect(beta).toContainText('Раздел Бета');

  for (const [id, title, section] of [
    ['a1', 'Тема А1', 'alpha'],
    ['a2', 'Тема А2', 'alpha'],
    ['b1', 'Тема Б1', 'beta'],
    ['exam-1', '7. Учебное задание', 'beta'],
  ]) {
    const node = page.locator(`[data-node="${id}"]`);
    await expect(node).toHaveText(title);
    await expect(node).toHaveAttribute('data-section-of', section);
  }

  const edges = await page.locator('[data-edge]').evaluateAll((els) => els.map((e) => e.getAttribute('data-edge')));
  expect(edges.sort()).toEqual(['a1->a2', 'a1->b1', 'a2->b1', 'b1->exam-1']);
});
