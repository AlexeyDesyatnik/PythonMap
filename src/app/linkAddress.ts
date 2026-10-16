// Ссылка с прогрессом: «верхние» освоенные узлы в части адреса после `#`,
// которая не уходит на сервер (ADR 0001). Отдельного «кода» нет.

const PREFIX = '#progress=';

/** Узлы из ссылки в адресе страницы; `null`, если страница открыта не по ссылке с прогрессом. */
export function readProgressLink(): string[] | null {
  if (!location.hash.startsWith(PREFIX)) return null;
  return location.hash
    .slice(PREFIX.length)
    .split(',')
    .filter((id) => id !== '')
    .map((id) => {
      try {
        return decodeURIComponent(id);
      } catch {
        // Испорченный кусок ссылки — как неизвестный узел, отбросится сам.
        return '';
      }
    });
}

/** Убирает обработанную ссылку из адреса, чтобы перезагрузка не обрабатывала её снова. */
export function clearProgressLink(): void {
  history.replaceState(history.state, '', location.pathname + location.search);
}

/** Полный адрес карты со ссылкой на эти узлы. */
export function progressLinkUrl(ids: string[]): string {
  return location.origin + location.pathname + location.search + PREFIX + ids.map(encodeURIComponent).join(',');
}
