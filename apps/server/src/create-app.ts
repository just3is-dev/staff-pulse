import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

/**
 * Общая точка сборки Nest-приложения для `main.ts` и для тестов: тесты
 * через `Test.createTestingModule` не подхватывают конфигурацию `main.ts`
 * автоматически (например, `setGlobalPrefix`), поэтому оба места
 * собирают приложение через эту функцию, а не дублируют конфигурацию.
 */
export async function createApp() {
  return NestFactory.create(AppModule);
}
