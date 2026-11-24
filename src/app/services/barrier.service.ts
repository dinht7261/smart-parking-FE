
import { Injectable, signal } from '@angular/core';

export type GateId = 'entry' | 'exit';
export type GateState = 'open' | 'closed';

export type EntryRecognitionType =
  | 'RESERVATION'
  | 'WALK_IN';

export type BarrierActionSource =
  | 'MANUAL'
  | 'AUTO_CHECK_IN';

export interface EntryRecognition {
  userCode: string;
  customerName: string | null;
  licensePlate: string;
  sessionCode: string;
  sessionType: EntryRecognitionType;
  occurredAt: string;
}

export interface BarrierHistoryItem {
  id: string;
  gate: GateId;
  state: GateState;
  createdAt: string;

  // Nguồn tạo thao tác
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
  // 1. TRẠNG THÁI HAI BARRIER
  // =====================================

  readonly states = signal<Record<GateId, GateState>>(
    this.loadStates()
  );

  // =====================================
  // 2. LỊCH SỬ ĐÓNG / MỞ BARRIER
  // =====================================

  readonly history = signal<BarrierHistoryItem[]>(
    this.loadHistory()
  );

  // =====================================
  // 3. THÔNG TIN NHẬN DIỆN KHÁCH GẦN NHẤT
  // =====================================

  readonly lastEntryRecognition =
    signal<EntryRecognition | null>(
      this.loadRecognition()
    );

  // =====================================
  // 4. LẤY TRẠNG THÁI BARRIER
  // =====================================

  getState(gate: GateId): GateState {
    return this.states()[gate];
  }

  // =====================================
  // 5. ĐIỀU KHIỂN BARRIER THỦ CÔNG
  // =====================================

  setState(
    gate: GateId,
    state: GateState,
    source: BarrierActionSource = 'MANUAL'
  ): boolean {

    if (this.states()[gate] === state) {
      return false;
    }

    this.states.update(current => ({
      ...current,
      [gate]: state
    }));

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

    return true;
  }

  // =====================================
  // 6. TỰ ĐỘNG MỞ BARRIER IN SAU CHECK-IN
  // =====================================

  openEntryAfterCheckIn(
    data: Omit<EntryRecognition, 'occurredAt'>
  ): void {

    const recognition: EntryRecognition = {
      ...data,
      occurredAt: new Date().toISOString()
    };

    // Cập nhật thông tin nhận diện khách

    this.lastEntryRecognition.set(recognition);

    // Tự động mở barrier IN

    const changed = this.setState(
      'entry',
      'open',
      'AUTO_CHECK_IN'
    );

    // Nếu barrier đã mở thì vẫn lưu nhận diện mới

    if (!changed) {
      this.save();
    }

  }

  // =====================================
  // 7. XÓA THÔNG TIN NHẬN DIỆN
  // =====================================

  clearRecognition(): void {

    this.lastEntryRecognition.set(null);

    this.save();
  }

  // =====================================
  // 8. LƯU DỮ LIỆU
  // =====================================

  private save(): void {

    try {

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
        'Không thể lưu trạng thái barrier:',
        error
      );

    }

  }

  // =====================================
  // 9. ĐỌC TRẠNG THÁI BARRIER
  // =====================================

  private loadStates(): Record<GateId, GateState> {

    const defaults: Record<GateId, GateState> = {
      entry: 'closed',
      exit: 'closed'
    };

    try {

      const raw = localStorage.getItem(STATE_KEY);

      if (!raw) {
        return defaults;
      }

      const parsed = JSON.parse(raw);

      return {
        entry: parsed?.entry === 'open'
          ? 'open' : 'closed',

        exit: parsed?.exit === 'open'
          ? 'open' : 'closed'
      };

    } catch {

      return defaults;
    }

  }

  // =====================================
  // 10. ĐỌC LỊCH SỬ
  // =====================================



private loadHistory(): BarrierHistoryItem[] {

  try {

    const raw = localStorage.getItem(HISTORY_KEY);

    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    const items: unknown[] = parsed;

    const validItems = items.filter(
      (item: unknown): item is BarrierHistoryItem => {

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

    return validItems.map(
      (item): BarrierHistoryItem => {

        // Khai báo kiểu tường minh để TypeScript
        // không tự mở rộng thành string.

        const source: BarrierActionSource =
          item.source === 'AUTO_CHECK_IN'
            ? 'AUTO_CHECK_IN'
            : 'MANUAL';

        return {
          ...item,
          source
        };

      }
    ).slice(0, 30);

  } catch (error) {

    console.error(
      'Không thể đọc lịch sử barrier:',
      error
    );

    return [];

  }

}



  // =====================================
  // 11. ĐỌC THÔNG TIN NHẬN DIỆN
  // =====================================

  private loadRecognition(): EntryRecognition | null {

    try {

      const raw = localStorage.getItem(RECOGNITION_KEY);

      if (!raw) {
        return null;
      }

      const item: unknown = JSON.parse(raw);

      if (typeof item !== 'object' || item === null) {
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
