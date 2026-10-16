// Переходы по двум уровням карты: обзору и графу раздела.
import type { Page } from '@playwright/test';

/** Раздел каждого узла учебной карты. */
const SECTION_OF: Record<string, string> = { a1: 'alpha', a2: 'alpha', b1: 'beta', 'exam-1': 'gamma', d1: 'delta' };

export const SECTIONS = ['alpha', 'beta', 'gamma', 'delta'];

const mapArea = (page: Page) => page.locator('[data-open-section]');

export async function toOverview(page: Page) {
  if ((await mapArea(page).getAttribute('data-open-section')) !== '') {
    await page.getByRole('button', { name: '← Обзор' }).click();
  }
}

/** Открывает граф раздела щелчком по разделу на обзоре. */
export async function openSection(page: Page, id: string) {
  if ((await mapArea(page).getAttribute('data-open-section')) === id) return;
  await toOverview(page);
  await page.locator(`[data-section="${id}"]`).click();
}

/** Узел на карте; если его раздел не открыт, сначала открывает раздел. */
export async function node(page: Page, id: string) {
  await openSection(page, SECTION_OF[id]);
  return page.locator(`[data-node="${id}"]`);
}

/** Узлы на карте, выделенные как узлы маршрута, по порядку их шагов, — по всем разделам. */
export async function routeOnMap(page: Page): Promise<string[]> {
  const steps: [number, string][] = [];
  for (const section of SECTIONS) {
    await openSection(page, section);
    steps.push(
      ...(await page
        .locator('[data-route-step]')
        .evaluateAll((els) =>
          els.map((el) => [Number(el.getAttribute('data-route-step')), el.getAttribute('data-node')!] as [number, string]),
        )),
    );
  }
  return steps.sort((a, b) => a[0] - b[0]).map(([, id]) => id);
}
