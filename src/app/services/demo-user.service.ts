
import {
  Injectable,
  computed,
  signal
} from '@angular/core';

// =====================================
// KIỂU DỮ LIỆU USER
// =====================================

export type DemoUserId =
  | 'A'
  | 'B'
  | 'C'
  | 'D';

export interface DemoUser {

  id: DemoUserId;
  name: string;
  plate: string;

}

// =====================================
// STORAGE KEY
// =====================================

const STORAGE_KEY =
  'smart-parking-active-user-v1';

@Injectable({
  providedIn: 'root'
})
export class DemoUserService {

  // =====================================
  // 4 TÀI KHOẢN CỐ ĐỊNH
  // =====================================

  readonly accounts: DemoUser[] = [

    {
      id: 'A',
      name: 'User A',
      plate: '29A-111.11'
    },

    {
      id: 'B',
      name: 'User B',
      plate: '29A-222.22'
    },

    {
      id: 'C',
      name: 'User C',
      plate: '29A-333.33'
    },

    {
      id: 'D',
      name: 'User D',
      plate: '29A-444.44'
    }

  ];

  // =====================================
  // USER ĐANG ĐƯỢC CHỌN
  // =====================================

  readonly selectedUserId =
    signal<DemoUserId>(
      this.loadSelectedUser()
    );

  // =====================================
  // THÔNG TIN USER HIỆN TẠI
  // =====================================

  readonly activeUser = computed(() => {

    return this.accounts.find(
      user =>
        user.id === this.selectedUserId()
    ) ?? this.accounts[0]!;

  });

  // =====================================
  // BIỂN SỐ XE HIỆN TẠI
  // =====================================

  readonly activePlate = computed(() => {

    return this.activeUser().plate;

  });

  // =====================================
  // CHUYỂN ĐỔI TÀI KHOẢN
  // =====================================

  selectUser(id: DemoUserId): void {

    if (!this.isValidUserId(id)) {
      return;
    }

    this.selectedUserId.set(id);

    this.saveSelectedUser(id);

  }

  // =====================================
  // LẤY THÔNG TIN USER THEO ID
  // =====================================

  getUser(id: DemoUserId): DemoUser | null {

    return this.accounts.find(
      user => user.id === id
    ) ?? null;

  }

  // =====================================
  // LẤY BIỂN SỐ XE THEO USER
  // =====================================

  getPlateByUserId(
    id: DemoUserId
  ): string | null {

    return this.getUser(id)?.plate ?? null;

  }

  // =====================================
  // TÌM USER THEO BIỂN SỐ
  // =====================================

  getUserByPlate(
    plate: string
  ): DemoUser | null {

    const normalized = this.normalizePlate(
      plate
    );

    return this.accounts.find(
      user =>
        this.normalizePlate(user.plate)
          === normalized
    ) ?? null;

  }

  // =====================================
  // KIỂM TRA BIỂN SỐ THUỘC USER
  // =====================================

  isPlateOwnedByUser(
    plate: string,
    userId: DemoUserId
  ): boolean {

    const user = this.getUser(userId);

    if (!user) {
      return false;
    }

    return (
      this.normalizePlate(plate) ===
      this.normalizePlate(user.plate)
    );

  }

  // =====================================
  // CHUẨN HÓA BIỂN SỐ
  // =====================================

  private normalizePlate(
    plate: string
  ): string {

    return plate
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');

  }

  // =====================================
  // KIỂM TRA USER ID
  // =====================================

  isValidUserId(
    value: unknown
  ): value is DemoUserId {

    return (
      value === 'A' ||
      value === 'B' ||
      value === 'C' ||
      value === 'D'
    );

  }

  // =====================================
  // ĐỌC USER TỪ LOCAL STORAGE
  // =====================================

  private loadSelectedUser(): DemoUserId {

    try {

      const saved =
        localStorage.getItem(STORAGE_KEY);

      if (this.isValidUserId(saved)) {
        return saved;
      }

      // Tương thích dữ liệu lưu dạng JSON.

      if (saved) {

        const parsed = JSON.parse(saved);

        if (this.isValidUserId(parsed)) {
          return parsed;
        }

      }

    } catch {

      return 'A';

    }

    return 'A';

  }

  // =====================================
  // LƯU USER VÀO LOCAL STORAGE
  // =====================================

  private saveSelectedUser(
    id: DemoUserId
  ): void {

    try {

      localStorage.setItem(
        STORAGE_KEY,
        id
      );

    } catch {

      console.warn(
        'Không thể lưu tài khoản demo.'
      );

    }

  }

}
