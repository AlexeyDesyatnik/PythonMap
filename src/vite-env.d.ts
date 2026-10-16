declare module 'virtual:map-data' {
  import type { RawMapData } from './core';
  import type { MapLayout } from './layout';
  const mapData: { data: RawMapData; layout: MapLayout };
  export default mapData;
}

interface ImportMetaEnv {
  /** Адрес канала для сообщений об ошибках; `{узел}` заменяется названием узла. */
  readonly VITE_REPORT_URL?: string;
}
