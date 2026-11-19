// Re-export the native module. On web, it will be resolved to ChargerServiceModule.web.ts
// and on native platforms to ChargerServiceModule.ts
export { default } from './src/ChargerServiceModule';
export * from './src/ChargerService.types';
