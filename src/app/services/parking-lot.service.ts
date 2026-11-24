
import {
  Injectable,
  computed,
  signal
} from '@angular/core';

// =====================================
// KIỂU DỮ LIỆU
// =====================================

export type FloorId = 'B1' | 'B2';

export type SpotStatus =
  | 'available'
  | 'occupied'
  | 'reserved'
  | 'maintenance';

export interface ParkingSpot {
  floor: FloorId;
  id: string;
  status: SpotStatus;
}

// =====================================
// CẤU HÌNH BAN ĐẦU
// =====================================

// Không gán sẵn xe đang đỗ hoặc đặt chỗ.
// Đây là trạng thái khởi tạo chưa xác minh
// bằng cảm biến phần cứng.

const INITIAL_SPOTS: ParkingSpot[] = [
  {
    floor: 'B1',
    id: 'A01',
    status: 'available'
  },
  {
    floor: 'B1',
    id: 'A02',
    status: 'available'
  },
  {
    floor: 'B2',
    id: 'A01',
    status: 'available'
  },
  {
    floor: 'B2',
    id: 'A02',
    status: 'available'
  }
];

// Key cũ chứa dữ liệu mô phỏng.
const OLD_STORAGE_KEY =
  'smart-parking-demo-spots-v1';

// Key mới để tránh giữ trạng thái giả cũ.
const STORAGE_KEY =
  'smart-parking-spots-pre-backend-v2';

const MAX_SPOTS = 200;

const VALID_STATUSES: SpotStatus[] = [
  'available',
  'occupied',
  'reserved',
  'maintenance'
];

@Injectable({
  providedIn: 'root'
})
export class ParkingLotService {

  // =====================================
  // DANH SÁCH TẦNG
  // =====================================

  readonly floors: FloorId[] = [
    'B1',
    'B2'
  ];

  // =====================================
  // DANH SÁCH VỊ TRÍ
  // =====================================

  readonly spots = signal<ParkingSpot[]>(
    this.load()
  );

  // =====================================
  // THỐNG KÊ
  // =====================================

  // Giữ cách gọi lot.totalCount
  // để tương thích với HTML hiện tại.

  get totalCount(): number {
    return this.spots().length;
  }

  readonly availableCount = computed(() =>
    this.count('available')
  );

  readonly occupiedCount = computed(() =>
    this.count('occupied')
  );

  readonly reservedCount = computed(() =>
    this.count('reserved')
  );

  readonly maintenanceCount = computed(() =>
    this.count('maintenance')
  );

  readonly availablePercent = computed(() => {

    const total = this.totalCount;

    if (total === 0) {
      return 0;
    }

    return Math.round(
      this.availableCount() / total * 100
    );

  });

  // =====================================
  // LẤY CHỖ ĐỖ THEO TẦNG
  // =====================================

  spotsOnFloor(
    floor: FloorId
  ): ParkingSpot[] {

    return this.spots().filter(
      spot => spot.floor === floor
    );
  }

  totalOnFloor(floor: FloorId): number {

    return this.spotsOnFloor(floor).length;
  }

  availableOnFloor(floor: FloorId): number {

    return this.spotsOnFloor(floor).filter(
      spot => spot.status === 'available'
    ).length;
  }

  // =====================================
  // THÊM VỊ TRÍ ĐỖ
  // =====================================

  addSpot(
    floor: FloorId,
    id: string
  ): boolean {

    const normalizedId = id
      .trim()
      .toUpperCase();

    if (!this.floors.includes(floor)) {
      return false;
    }

    if (!this.isValidSpotId(normalizedId)) {
      return false;
    }

    if (this.totalCount >= MAX_SPOTS) {
      return false;
    }

    const exists = this.spots().some(
      spot =>
        spot.floor === floor &&
        spot.id === normalizedId
    );

    if (exists) {
      return false;
    }

    // Vị trí mới cần kiểm tra trước khi dùng.
    const newSpot: ParkingSpot = {
      floor,
      id: normalizedId,
      status: 'maintenance'
    };

    this.updateSpots([
      ...this.spots(),
      newSpot
    ]);

    return true;
  }

  // =====================================
  // XÓA VỊ TRÍ ĐỖ
  // =====================================

  removeSpot(
    floor: FloorId,
    id: ParkingSpot['id']
  ): boolean {

    const current = this.spots().find(
      spot =>
        spot.floor === floor &&
        spot.id === id
    );

    if (!current) {
      return false;
    }

    if (
      current.status === 'occupied' ||
      current.status === 'reserved'
    ) {
      return false;
    }

    this.updateSpots(
      this.spots().filter(
        spot =>
          !(
            spot.floor === floor &&
            spot.id === id
          )
      )
    );

    return true;
  }

  // =====================================
  // BẢO TRÌ
  // =====================================

  toggleMaintenance(
    floor: FloorId,
    id: ParkingSpot['id']
  ): boolean {

    const current = this.spots().find(
      spot =>
        spot.floor === floor &&
        spot.id === id
    );

    if (!current) {
      return false;
    }

    if (
      current.status !== 'available' &&
      current.status !== 'maintenance'
    ) {
      return false;
    }

    const nextStatus: SpotStatus =
      current.status === 'available'
        ? 'maintenance'
        : 'available';

    return this.changeSpotStatus(
      floor,
      id,
      ['available', 'maintenance'],
      nextStatus
    );
  }

  // =====================================
  // ĐẶT CHỖ
  // =====================================

  reserveSpot(
    floor: FloorId,
    id: ParkingSpot['id']
  ): boolean {

    return this.changeSpotStatus(
      floor,
      id,
      ['available'],
      'reserved'
    );
  }

  // =====================================
  // CHECK-IN
  // =====================================

  // Giữ hàm nghiệp vụ để tương thích
  // với các service đang sử dụng.
  // Sau này Backend xác nhận xe vào.

  checkIn(
    floor: FloorId,
    id: ParkingSpot['id']
  ): boolean {

    return this.changeSpotStatus(
      floor,
      id,
      ['available', 'reserved'],
      'occupied'
    );
  }

  // =====================================
  // CHECK-OUT
  // =====================================

  checkOut(
    floor: FloorId,
    id: ParkingSpot['id']
  ): boolean {

    return this.changeSpotStatus(
      floor,
      id,
      ['occupied'],
      'available'
    );
  }

  // =====================================
  // NHẬN DANH SÁCH VỊ TRÍ
  // =====================================

  // Dùng khi tích hợp API Backend sau này.

  replaceSpots(
    newSpots: ParkingSpot[]
  ): boolean {

    if (!this.validateSpots(newSpots)) {
      return false;
    }

    this.updateSpots(
      newSpots.map(spot => ({ ...spot }))
    );

    return true;
  }

  // =====================================
  // ĐỔI TRẠNG THÁI VỊ TRÍ
  // =====================================

  private changeSpotStatus(
    floor: FloorId,
    id: ParkingSpot['id'],
    allowedStatuses: SpotStatus[],
    newStatus: SpotStatus
  ): boolean {

    const current = this.spots().find(
      spot =>
        spot.floor === floor &&
        spot.id === id
    );

    if (!current) {
      return false;
    }

    if (!allowedStatuses.includes(current.status)) {
      return false;
    }

    const updated = this.spots().map(
      spot => {

        if (
          spot.floor === floor &&
          spot.id === id
        ) {
          return {
            ...spot,
            status: newStatus
          };
        }

        return spot;
      }
    );

    this.updateSpots(updated);

    return true;
  }

  // =====================================
  // CẬP NHẬT SIGNAL
  // =====================================

  private updateSpots(
    updated: ParkingSpot[]
  ): void {

    this.spots.set(updated);

    this.save(updated);
  }

  // =====================================
  // ĐẾM THEO TRẠNG THÁI
  // =====================================

  private count(
    status: SpotStatus
  ): number {

    return this.spots().filter(
      spot => spot.status === status
    ).length;
  }

  // =====================================
  // KIỂM TRA MÃ VỊ TRÍ
  // =====================================

  private isValidSpotId(
    id: string
  ): boolean {

    return /^[A-Z0-9-]{2,12}$/.test(id);
  }

  // =====================================
  // KIỂM TRA DỮ LIỆU
  // =====================================

  private isValidSpot(
    input: unknown
  ): input is ParkingSpot {

    if (
      typeof input !== 'object' ||
      input === null
    ) {
      return false;
    }

    const spot = input as Partial<ParkingSpot>;

    return (
      (
        spot.floor === 'B1' ||
        spot.floor === 'B2'
      ) &&
      typeof spot.id === 'string' &&
      this.isValidSpotId(spot.id) &&
      VALID_STATUSES.includes(
        spot.status as SpotStatus
      )
    );
  }

  private validateSpots(
    input: unknown
  ): input is ParkingSpot[] {

    if (
      !Array.isArray(input) ||
      input.length > MAX_SPOTS
    ) {
      return false;
    }

    const keys = new Set<string>();

    for (const item of input) {

      if (!this.isValidSpot(item)) {
        return false;
      }

      const key = `${item.floor}:${item.id}`;

      if (keys.has(key)) {
        return false;
      }

      keys.add(key);
    }

    return true;
  }

  // =====================================
  // LƯU DỮ LIỆU MỚI
  // =====================================

  private save(
    spots: ParkingSpot[]
  ): void {

    try {

      if (typeof localStorage === 'undefined') {
        return;
      }

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(spots)
      );

    } catch (error) {

      console.error(
        'Không thể lưu vị trí đỗ:',
        error
      );
    }
  }

  // =====================================
  // ĐỌC DỮ LIỆU
  // =====================================

  private load(): ParkingSpot[] {

    const defaults = INITIAL_SPOTS.map(
      spot => ({ ...spot })
    );

    try {

      if (typeof localStorage === 'undefined') {
        return defaults;
      }

      // Ưu tiên dữ liệu đã chuyển đổi.
      const current = localStorage.getItem(
        STORAGE_KEY
      );

      if (current !== null) {

        const parsed: unknown = JSON.parse(current);

        if (this.validateSpots(parsed)) {
          return parsed;
        }

        // Dữ liệu mới lỗi định dạng.
        // Trả về cấu hình mặc định.
        return defaults;
      }

      // =====================================
      // CHUYỂN TỪ DỮ LIỆU DEMO CŨ
      // =====================================

      const oldData = localStorage.getItem(
        OLD_STORAGE_KEY
      );

      if (oldData !== null) {

        const parsed: unknown = JSON.parse(oldData);

        if (this.validateSpots(parsed)) {

          // Giữ số lượng vị trí được cấu hình.
          // Giữ trạng thái bảo trì.
          // Bỏ trạng thái xe/đặt chỗ mô phỏng cũ.

          const cleaned: ParkingSpot[] =
            parsed.map(spot => ({

              ...spot,

              status:
                spot.status === 'occupied' ||
                spot.status === 'reserved'
                  ? 'available'
                  : spot.status

            }));

          this.save(cleaned);

          return cleaned;
        }
      }

      // Không có dữ liệu trước đó.
      this.save(defaults);

      return defaults;

    } catch (error) {

      console.error(
        'Không thể đọc dữ liệu bãi xe:',
        error
      );

      return defaults;
    }
  }

}
