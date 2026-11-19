import { NativeModule, requireNativeModule } from 'expo';

declare class ChargerServiceModule extends NativeModule<{}> {
  setSounds(connectUri: string | null, disconnectUri: string | null): void;
  start(): void;
  stop(): void;
  isRunning(): boolean;
}

export default requireNativeModule<ChargerServiceModule>('ChargerService');
