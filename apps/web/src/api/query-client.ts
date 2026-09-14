import { QueryClient } from '@tanstack/react-query';

/** Свежесть данных по заданию: 5 секунд после успешного ответа. */
const STALE_TIME_MS = 5_000;

/** Клиент кэша с настройками проекта; один на приложение, новый на каждый тест. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME_MS,
        // Неизменённые данные сохраняют прежние ссылки — без лишних перерисовок.
        structuralSharing: true,
        // Автоповторов нет: по спеке повтор после ошибки — только кнопкой.
        retry: false,
        // Возврат фокуса и восстановление сети перезапрашивают данные только
        // если они уже устарели: пока данные свежие, запросов нет, а после
        // 5 секунд пользователь, вернувшийся на вкладку, видит актуальное.
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
    },
  });
}
