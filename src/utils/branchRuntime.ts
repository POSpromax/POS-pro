export type BranchRuntimeChannel = 'ORDERS' | 'OPERATIONS' | 'SHIFT';
export type BranchRuntimeConnectionState = 'CONNECTING' | 'HEALTHY' | 'DEGRADED';

export interface BranchRuntimeToken {
  branchId: string;
  epoch: number;
}

export interface BranchRuntimeDiagnostic {
  branchId: string;
  epoch: number;
  startedAt: number;
  channels: Record<BranchRuntimeChannel, BranchRuntimeConnectionState>;
  lastRealtimeEvent: Partial<Record<BranchRuntimeChannel, number>>;
  lastSuccessfulSync: Partial<Record<BranchRuntimeChannel, number>>;
}

const initialChannels = (): Record<BranchRuntimeChannel, BranchRuntimeConnectionState> => ({
  ORDERS: 'CONNECTING',
  OPERATIONS: 'CONNECTING',
  SHIFT: 'CONNECTING',
});

/**
 * BranchRuntimeGuard is the outlet runtime coordinator for asynchronous work.
 * Switching outlet increments an epoch. Every branch-scoped request captures a
 * token and must prove that token is still current before mutating React state.
 * This prevents a slow response from outlet A from overwriting outlet B after
 * the operator changes branch.
 */
export class BranchRuntimeGuard {
  private branchId = '';
  private epoch = 0;
  private startedAt = Date.now();
  private channels = initialChannels();
  private lastRealtimeEvent: Partial<Record<BranchRuntimeChannel, number>> = {};
  private lastSuccessfulSync: Partial<Record<BranchRuntimeChannel, number>> = {};

  begin(branchId: string): BranchRuntimeToken {
    if (this.branchId !== branchId) {
      this.branchId = branchId;
      this.epoch += 1;
      this.startedAt = Date.now();
      this.channels = initialChannels();
      this.lastRealtimeEvent = {};
      this.lastSuccessfulSync = {};
    }
    return this.snapshot(branchId);
  }

  snapshot(branchId = this.branchId): BranchRuntimeToken {
    return { branchId, epoch: this.epoch };
  }

  isCurrent(token: BranchRuntimeToken): boolean {
    return token.branchId === this.branchId && token.epoch === this.epoch;
  }

  recordConnection(token: BranchRuntimeToken, channel: BranchRuntimeChannel, state: BranchRuntimeConnectionState): void {
    if (!this.isCurrent(token)) return;
    this.channels[channel] = state;
  }

  recordRealtime(token: BranchRuntimeToken, channel: BranchRuntimeChannel): void {
    if (!this.isCurrent(token)) return;
    this.lastRealtimeEvent[channel] = Date.now();
  }

  recordSync(token: BranchRuntimeToken, channel: BranchRuntimeChannel): void {
    if (!this.isCurrent(token)) return;
    this.lastSuccessfulSync[channel] = Date.now();
  }

  diagnostic(): BranchRuntimeDiagnostic {
    return {
      branchId: this.branchId,
      epoch: this.epoch,
      startedAt: this.startedAt,
      channels: { ...this.channels },
      lastRealtimeEvent: { ...this.lastRealtimeEvent },
      lastSuccessfulSync: { ...this.lastSuccessfulSync },
    };
  }

  get currentBranchId(): string {
    return this.branchId;
  }

  get currentEpoch(): number {
    return this.epoch;
  }
}