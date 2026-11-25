
import { Injectable, signal } from '@angular/core';

export type GateId = 'entry' | 'exit';
export type GateState = 'open' | 'closed';

export type EntryRecognitionType =
  | 'RESERVATION'
  | 'WALK_IN';

export type BarrierActionSource =
  | 'MANUAL'
  | 'HARDWARE'
  | 'AUTO_CHECK_OUT'
  | 'AUTO_CLOSE'
  | 'AUTO_CHECK_IN'; // Giữ tương thích lịch sử cũ

export interface EntryRecognition {
  userCode: string;
  customerName: string | null;
  licensePlate: string;
  sessionCode: string;
  sessionType: EntryRecognitionType;
  occurredAt: string;
}

interface BarrierSyncMessage {
  type: 'BARRIER_SYNC';
  states: Record<GateId, GateState>;
  history: BarrierHistoryItem[];
  recognition: EntryRecognition | null;
}

export interface BarrierHistoryItem {
  id: string;
  gate: GateId;
  state: GateState;
  createdAt: string;
  source?: BarrierActionSource;
}

const STATE_KEY =
  'smart-parking-barrier-state-v1';

const HISTORY_KEY =
  'smart-parking-barrier-history-v1';

const RECOGNITION_KEY =
  'smart-parking-entry-recognition-v1';

@Injectable({
  providedIn: 'root'
})
export class BarrierService {

  // =====================================
  // 1. CẤU HÌNH TỰ ĐỘNG ĐÓNG
  // =====================================

  private readonly AUTO_CLOSE_MS = 5000;

  private readonly autoCloseTimers = new Map<
    GateId,
    ReturnType<typeof setTimeout>
  >();

  // =====================================
// ĐỒNG BỘ BARRIER GIỮA CÁC TAB
// =====================================

private readonly syncChannel: BroadcastChannel | null =
  typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('smart-parking-barrier-sync-v1')
    : null;

  // =====================================
  // 2. TRẠNG THÁI BARRIER
  // =====================================

  readonly states = signal<Record<GateId, GateState>>(
    this.loadStates()
  );

  // =====================================
  // 3. LỊCH SỬ ĐIỀU KHIỂN
  // =====================================

  readonly history = signal<BarrierHistoryItem[]>(
    this.loadHistory()
  );

  // =====================================
  // 4. THÔNG TIN NHẬN DIỆN KHÁCH
  // =====================================

  readonly lastEntryRecognition =
    signal<EntryRecognition | null>(
      this.loadRecognition()
    );

  // =====================================
// ĐỒNG BỘ BARRIER GIỮA CÁC TAB
// =====================================

constructor() {

  this.syncChannel?.addEventListener(
    'message',
    (event: MessageEvent<unknown>) => {

      this.applyRemoteMessage(event.data);

    }
  );

}

  // =====================================
  // 5. LẤY TRẠNG THÁI BARRIER
  // =====================================

  getState(gate: GateId): GateState {
    return this.states()[gate];
  }

  // =====================================
  // 6. XÓA TIMER CŨ
  // =====================================

  private clearAutoCloseTimer(gate: GateId): void {

    const timer = this.autoCloseTimers.get(gate);

    if (timer !== undefined) {

      clearTimeout(timer);

      this.autoCloseTimers.delete(gate);

    }

  }

  // =====================================
  // 7. CẬP NHẬT TRẠNG THÁI BARRIER
  // =====================================

  setState(
    gate: GateId,
    state: GateState,
    source: BarrierActionSource = 'MANUAL'
  ): boolean {

    const currentState = this.states()[gate];

    // Không xử lý nếu trạng thái không thay đổi
    if (currentState === state) {
      return false;
    }

    // Lệnh thủ công hoặc lệnh đóng sẽ hủy timer cũ
    if (source === 'MANUAL' || state === 'closed') {
      this.clearAutoCloseTimer(gate);
    }

    // Cập nhật Signal
    this.states.update(current => ({
      ...current,
      [gate]: state
    }));

    // Ghi nhận lịch sử
    const item: BarrierHistoryItem = {

      id: `barrier-${Date.now()}-${Math.random()
        .toString(36).slice(2, 8)}`,

      gate,

      state,

      createdAt: new Date().toISOString(),

      source

    };

    this.history.update(current => [
      item,
      ...current
    ].slice(0, 30));

this.save();

this.broadcastSync();

return true;
  }


private broadcastSync(): void {

  const message: BarrierSyncMessage = {
    type: 'BARRIER_SYNC',
    states: this.states(),
    history: this.history(),
    recognition: this.lastEntryRecognition()
  };

  this.syncChannel?.postMessage(message);

}

private applyRemoteMessage(payload: unknown): void {

  if (
    typeof payload !== 'object' ||
    payload === null
  ) {
    return;
  }

  const message = payload as Record<string, unknown>;

  if (message['type'] !== 'BARRIER_SYNC') {
    return;
  }

  const rawStates = message['states'];

  if (
    typeof rawStates !== 'object' ||
    rawStates === null
  ) {
    return;
  }

  const states = rawStates as Record<string, unknown>;

  if (
    (states['entry'] !== 'open' &&
      states['entry'] !== 'closed') ||
    (states['exit'] !== 'open' &&
      states['exit'] !== 'closed')
  ) {
    return;
  }

  // Đồng bộ trạng thái hai barrier
  this.states.set({
    entry: states['entry'],
    exit: states['exit']
  });

  // Đồng bộ lịch sử
  if (Array.isArray(message['history'])) {

    const validHistory = message['history'].filter(
      (item): item is BarrierHistoryItem => {

        if (
          typeof item !== 'object' ||
          item === null
        ) {
          return false;
        }

        const data = item as Record<string, unknown>;

        return (
          typeof data['id'] === 'string' &&
          (data['gate'] === 'entry' ||
            data['gate'] === 'exit') &&
          (data['state'] === 'open' ||
            data['state'] === 'closed') &&
          typeof data['createdAt'] === 'string'
        );

      }
    );

    this.history.set(validHistory.slice(0, 30));

  }

  // Đồng bộ thông tin nhận diện
  const recognition = message['recognition'];

  if (recognition === null) {

    this.lastEntryRecognition.set(null);

  } else if (
    typeof recognition === 'object' &&
    recognition !== null
  ) {

    const data = recognition as Record<string, unknown>;

    if (
      typeof data['userCode'] === 'string' &&
      typeof data['licensePlate'] === 'string' &&
      typeof data['sessionCode'] === 'string' &&
      typeof data['occurredAt'] === 'string' &&
      (
        data['sessionType'] === 'RESERVATION' ||
        data['sessionType'] === 'WALK_IN'
      )
    ) {
      this.lastEntryRecognition.set(
        recognition as EntryRecognition
      );
    }

  }

  // Lưu dữ liệu nhưng KHÔNG broadcast ngược lại
  // để tránh vòng lặp đồng bộ giữa các tab.
  this.save();

  console.log(
    '[BARRIER SYNC] Đã đồng bộ dữ liệu từ tab khác:',
    this.states()
  );

}



  // =====================================
  // 8. NHẬN TRẠNG THÁI TỪ THIẾT BỊ IN
  // =====================================

  syncEntryStateFromHardware(
    state: GateState
  ): void {

    // Trạng thái thiết bị là nguồn dữ liệu chính
    this.clearAutoCloseTimer('entry');

    this.setState(
      'entry',
      state,
      'HARDWARE'
    );

  }

  // =====================================
  // 9. LƯU THÔNG TIN NHẬN DIỆN SAU CHECK-IN
  // =====================================

  recordEntryRecognition(
    data: Omit<EntryRecognition, 'occurredAt'>
  ): void {

    const recognition: EntryRecognition = {

      ...data,

      occurredAt: new Date().toISOString()

    };

    this.lastEntryRecognition.set(recognition);

    this.save();

  }

  // Tương thích với CustomerCheckIn hiện tại.
  // Không tự động mở barrier IN.

  openEntryAfterCheckIn(
    data: Omit<EntryRecognition, 'occurredAt'>
  ): void {

    this.recordEntryRecognition(data);

  }

  // =====================================
  // 10. TỰ ĐỘNG MỞ BARRIER OUT SAU THANH TOÁN
  // =====================================

  openExitAfterPayment(): void {

    this.openTemporarily(
      'exit',
      'AUTO_CHECK_OUT'
    );

  }

  // =====================================
  // 11. MỞ BARRIER TẠM THỜI
  // =====================================


private openTemporarily(
  gate: GateId,
  source: 'AUTO_CHECK_IN' | 'AUTO_CHECK_OUT'
): void {

  // Hủy timer cũ
  this.clearAutoCloseTimer(gate);

  // Mở barrier
  this.setState(gate, 'open', source);

  console.log(
    `[BARRIER] ${gate.toUpperCase()} ĐANG MỞ`,
    this.getState(gate)
  );

  // Tự động đóng sau 5 giây
  const timer = setTimeout(() => {

    this.autoCloseTimers.delete(gate);

    this.setState(
      gate,
      'closed',
      'AUTO_CLOSE'
    );

    console.log(
      `[BARRIER] ${gate.toUpperCase()} ĐÃ TỰ ĐỘNG ĐÓNG`,
      this.getState(gate)
    );

  }, this.AUTO_CLOSE_MS);

  this.autoCloseTimers.set(gate, timer);

  this.broadcastSync();

  this.save();
}


  // =====================================
  // 12. XÓA THÔNG TIN NHẬN DIỆN
  // =====================================

  clearRecognition(): void {

    this.lastEntryRecognition.set(null);

    this.save();

  }

  // =====================================
  // 13. LƯU DỮ LIỆU
  // =====================================

  private save(): void {

    try {

      if (typeof localStorage === 'undefined') {
        return;
      }

      localStorage.setItem(
        STATE_KEY,
        JSON.stringify(this.states())
      );

      localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(this.history())
      );

      localStorage.setItem(
        RECOGNITION_KEY,
        JSON.stringify(this.lastEntryRecognition())
      );

    } catch (error) {

      console.error(
        'Không thể lưu dữ liệu barrier:',
        error
      );

    }

  }

  // =====================================
  // 14. ĐỌC TRẠNG THÁI BARRIER
  // =====================================

  private loadStates(): Record<GateId, GateState> {

    const defaults: Record<GateId, GateState> = {
      entry: 'closed',
      exit: 'closed'
    };

    try {

      if (typeof localStorage === 'undefined') {
        return defaults;
      }

      const raw = localStorage.getItem(STATE_KEY);

      if (!raw) {
        return defaults;
      }

      const parsed: unknown = JSON.parse(raw);

      if (
        typeof parsed !== 'object' ||
        parsed === null
      ) {
        return defaults;
      }

      const data = parsed as Record<string, unknown>;

      return {

        entry: data['entry'] === 'open'
          ? 'open'
          : 'closed',

        // OUT là trạng thái mở tạm thời.
        // Khi tải lại ứng dụng, không khôi phục OPEN cũ
        // vì timer 5 giây đã mất.

        exit: 'closed'

      };

    } catch {

      return defaults;

    }

  }

  // =====================================
  // 15. ĐỌC LỊCH SỬ
  // =====================================

  private loadHistory(): BarrierHistoryItem[] {

    try {

      if (typeof localStorage === 'undefined') {
        return [];
      }

      const raw = localStorage.getItem(HISTORY_KEY);

      if (!raw) {
        return [];
      }

      const parsed: unknown = JSON.parse(raw);

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed

        .filter((item): item is Record<string, unknown> => {

          if (
            typeof item !== 'object' ||
            item === null
          ) {
            return false;
          }

          return (
            typeof item['id'] === 'string' &&
            (item['gate'] === 'entry' ||
              item['gate'] === 'exit') &&
            (item['state'] === 'open' ||
              item['state'] === 'closed') &&
            typeof item['createdAt'] === 'string'
          );

        })

        .map(item => {

          const rawSource = item['source'];

          let source: BarrierActionSource = 'MANUAL';

          if (
            rawSource === 'MANUAL' ||
            rawSource === 'HARDWARE' ||
            rawSource === 'AUTO_CHECK_OUT' ||
            rawSource === 'AUTO_CLOSE' ||
            rawSource === 'AUTO_CHECK_IN'
          ) {
            source = rawSource;
          }

          return {

            id: item['id'] as string,

            gate: item['gate'] as GateId,

            state: item['state'] as GateState,

            createdAt: item['createdAt'] as string,

            source

          };

        })

        .slice(0, 30);

    } catch (error) {

      console.error(
        'Không thể đọc lịch sử barrier:',
        error
      );

      return [];

    }

  }

  // =====================================
  // 16. ĐỌC THÔNG TIN NHẬN DIỆN
  // =====================================

  private loadRecognition(): EntryRecognition | null {

    try {

      if (typeof localStorage === 'undefined') {
        return null;
      }

      const raw = localStorage.getItem(RECOGNITION_KEY);

      if (!raw) {
        return null;
      }

      const item: unknown = JSON.parse(raw);

      if (
        typeof item !== 'object' ||
        item === null
      ) {
        return null;
      }

      const data = item as Record<string, unknown>;

      if (

        typeof data['userCode'] !== 'string' ||

        typeof data['licensePlate'] !== 'string' ||

        typeof data['sessionCode'] !== 'string' ||

        typeof data['occurredAt'] !== 'string' ||

        (
          data['sessionType'] !== 'RESERVATION' &&
          data['sessionType'] !== 'WALK_IN'
        )

      ) {
        return null;
      }

      return {

        userCode: data['userCode'],

        customerName:
          typeof data['customerName'] === 'string'
            ? data['customerName']
            : null,

        licensePlate: data['licensePlate'],

        sessionCode: data['sessionCode'],

        sessionType: data['sessionType'],

        occurredAt: data['occurredAt']

      };

    } catch {

      return null;

    }

  }

}
