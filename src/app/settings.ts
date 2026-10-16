// Настройки сайта задаются в файле `.env` в корне проекта.

const REPORT_URL = import.meta.env.VITE_REPORT_URL?.trim() ?? '';

/** Ссылка «сообщить об ошибке» с подставленным названием узла; `null`, пока канал не задан. */
export function reportLink(nodeName: string): string | null {
  return REPORT_URL ? REPORT_URL.replaceAll('{узел}', encodeURIComponent(nodeName)) : null;
}
