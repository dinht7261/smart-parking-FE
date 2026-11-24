import {
  Injectable,
  DestroyRef,
  inject,
  signal,
  computed
} from '@angular/core';

const STORAGE_KEY = 'smart-parking-simulation-clock-v1';

@Injectable({
  providedIn: 'root'
})
export class SimulationClockService {

  private readonly destroyRef = inject(DestroyRef);

  // Giờ thực của thiết bị
  private readonly systemTimeMs = signal(Date.now());

  // null = sử dụng giờ thực
  // number = sử dụng giờ mô phỏng
  private readonly simulatedTimeMs = signal<number | null>(
    this.load()
  );

  // Kiểm tra có đang bật chế độ demo không
  readonly isDemo = computed(() =>
    this.simulatedTimeMs() !== null
  );

  // THỜI GIAN CHUNG CHO TOÀN BỘ NGHIỆP VỤ
  readonly now = computed(() =>
    new Date(
      this.simulatedTimeMs() ?? this.systemTimeMs()
    )
  );

  // Thời gian thực để đối chiếu
  readonly systemNow = computed(() =>
    new Date(this.systemTimeMs())
  );

  constructor() {

    // Cập nhật giờ thực mỗi 30 giây
    const timer = setInterval(() => {
      this.systemTimeMs.set(Date.now());
    }, 30000);

    this.destroyRef.onDestroy(() => {
      clearInterval(timer);
    });
  }

  // Chọn ngày giờ mô phỏng
  setSimulatedTime(value: string): boolean {

    const timestamp = new Date(value).getTime();

    if (Number.isNaN(timestamp)) {
      return false;
    }

    this.simulatedTimeMs.set(timestamp);

    this.save();

    return true;
  }

  // Chọn nhanh giờ mô phỏng trong ngày hiện tại
  setPreset(hour: number, minute: number): void {

    const date = new Date(this.systemTimeMs());

    date.setHours(hour, minute, 0, 0);

    this.simulatedTimeMs.set(date.getTime());

    this.save();
  }

  // Quay về thời gian thực
  useRealTime(): void {

    this.simulatedTimeMs.set(null);

    this.systemTimeMs.set(Date.now());

    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Không thể tắt chế độ demo:', error);
    }
  }

  // Chuyển Date thành định dạng cho input datetime-local
  toInputValue(date: Date): string {

    const pad = (value: number): string =>
      String(value).padStart(2, '0');

    return (
      date.getFullYear() + '-' +
      pad(date.getMonth() + 1) + '-' +
      pad(date.getDate()) + 'T' +
      pad(date.getHours()) + ':' +
      pad(date.getMinutes())
    );
  }

  // Lưu thời gian mô phỏng
  private save(): void {

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(this.simulatedTimeMs())
      );
    } catch (error) {
      console.error('Không thể lưu thời gian mô phỏng:', error);
    }
  }

  // Đọc thời gian đã lưu
  private load(): number | null {

    try {

      const raw = localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        return null;
      }

      const parsed: unknown = JSON.parse(raw);

      if (
        typeof parsed !== 'number' ||
        !Number.isFinite(parsed)
      ) {
        return null;
      }

      return parsed;

    } catch {
      return null;
    }
  }
}