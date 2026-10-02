import { LipSyncProvider } from '../base-provider';
import { SyncLabsLipSyncProvider } from './synclabs-provider';

export function getLipSyncProvider(providerName: string): LipSyncProvider {
  switch (providerName.toUpperCase()) {
    case 'SYNCLABS':
      return new SyncLabsLipSyncProvider();
    default:
      return new SyncLabsLipSyncProvider();
  }
}
