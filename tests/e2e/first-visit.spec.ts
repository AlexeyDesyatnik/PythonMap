import { expect, test, type Page } from '@playwright/test';
import { node } from './helpers';

// Здесь браузер чистый: ученик открывает карту впервые.
test.use({ storageState: { cookies: [], origins: [] } });

const steps = (page: Page) => page.getByRole('dialog', { name: /Первый визит/ });
const markStep = (page: Page) => page.getByRole('region', { name: 'Первый визит: отметка' });
const routeItems = (page: Page) => page.getByRole('region', { name: 'Маршрут' }).getByRole('listitem');
const masteredBox = (page: Page) =>
  page.getByRole('region', { name: 'Узел' }).getByRole('checkbox', { name: 'Освоен' });

test('первый визит: выбор ступени и отметка на карте заканчиваются маршрутом', async ({ page }) => {
  await page.goto('/');

  // Шаг 1: цель и ступень.
  await expect(steps(page)).toContainText('Шаг 1 из 2');
  await steps(page).getByRole('combobox', { name: 'Цель' }).selectOption({ label: 'Экзамен' });
  await steps(page).getByRole('combobox', { name: 'Ступень' }).selectOption({ label: 'Ступень 2' });
  await steps(page).getByRole('button', { name: 'Дальше' }).click();
  await expect(steps(page)).toBeHidden();

  // Шаг 2: отметка на самой карте; пререквизиты отмечаются каскадом.
  await expect(markStep(page)).toContainText('Шаг 2 из 2');
  await (await node(page, 'a2')).click();
  await masteredBox(page).check();
  await expect(page.locator('[data-node="a1"]')).toHaveAttribute('data-mastered', 'true');
  await markStep(page).getByRole('button', { name: 'Готово' }).click();
  await expect(markStep(page)).toBeHidden();

  // Маршрут до выбранной ступени — без уже освоенного.
  await expect(routeItems(page)).toHaveText([/Тема Б1/, /7\. Учебное задание/]);
  await expect(page.getByRole('combobox', { name: 'Ступень' })).toHaveValue('exam-2');

  // При повторном открытии шагов нет.
  await page.reload();
  await expect(routeItems(page)).toHaveText([/Тема Б1/, /7\. Учебное задание/]);
  await expect(steps(page)).toHaveCount(0);
  await expect(markStep(page)).toHaveCount(0);
});

test('оба шага можно пропустить; пропущенные шаги тоже больше не показываются', async ({ page }) => {
  await page.goto('/');

  // Выбор, не подтверждённый кнопкой «Дальше», не применяется.
  await steps(page).getByRole('combobox', { name: 'Цель' }).selectOption({ label: 'Экзамен' });
  await steps(page).getByRole('combobox', { name: 'Ступень' }).selectOption({ label: 'Ступень 1' });
  await steps(page).getByRole('button', { name: 'Пропустить' }).click();
  await expect(steps(page)).toBeHidden();
  await expect(page.getByRole('combobox', { name: 'Ступень' })).toHaveValue('');

  await expect(markStep(page)).toContainText('Шаг 2 из 2');
  await markStep(page).getByRole('button', { name: 'Пропустить' }).click();
  await expect(markStep(page)).toBeHidden();
  await expect(page.getByRole('region', { name: 'Маршрут' })).toContainText('Выберите цель и ступень');

  await page.reload();
  await expect(page.getByTestId('map-heading')).toHaveText('Обзор: разделы карты');
  await expect(steps(page)).toHaveCount(0);
  await expect(markStep(page)).toHaveCount(0);
});

test('если в браузере уже есть прогресс, шага отметки нет', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('python-map/progress', JSON.stringify(['a1']));
      sessionStorage.setItem('seeded', '1');
    }
  });
  await page.goto('/');

  // Второго шага не будет — и «1 из 2» не пишется.
  await expect(steps(page)).not.toContainText('Шаг 1 из 2');
  await steps(page).getByRole('combobox', { name: 'Цель' }).selectOption({ label: 'Экзамен' });
  await steps(page).getByRole('combobox', { name: 'Ступень' }).selectOption({ label: 'Ступень 1' });
  await steps(page).getByRole('button', { name: 'Дальше' }).click();

  await expect(steps(page)).toBeHidden();
  await expect(markStep(page)).toHaveCount(0);
  await expect(routeItems(page)).toHaveText([/Тема А2/]);

  await page.reload();
  await expect(steps(page)).toHaveCount(0);
});
