
import {
  Injectable,
  computed,
  inject
} from '@angular/core';

import {
  DemoUserService,
  type DemoUserId
} from './demo-user.service';

// =====================================
// DỮ LIỆU THUỘC VỀ MỘT USER
// =====================================

export interface UserOwnedRecord {
  userId: DemoUserId;
}

@Injectable({
  providedIn: 'root'
})
export class DemoUserScopeService {

  private readonly demoUsers = inject(
    DemoUserService
  );

  // =====================================
  // USER ĐANG ĐƯỢC CHỌN
  // =====================================

  readonly activeUserId = computed(
    () => this.demoUsers.selectedUserId()
  );

  // =====================================
  // GẮN CHỦ SỞ HỮU KHI TẠO DỮ LIỆU
  // =====================================

  assignOwner<T extends object>(
    record: T
  ): T & UserOwnedRecord {

    return {
      ...record,
      userId: this.activeUserId()
    };
  }

  // =====================================
  // LỌC DỮ LIỆU CỦA USER HIỆN TẠI
  // =====================================

  forCurrentUser<T extends UserOwnedRecord>(
    records: readonly T[]
  ): T[] {

    const currentId = this.activeUserId();

    return records.filter(
      record => record.userId === currentId
    );
  }

  // =====================================
  // KIỂM TRA QUYỀN SỞ HỮU
  // =====================================

  isCurrentUserOwner(
    record: UserOwnedRecord | null | undefined
  ): boolean {

    if (!record) {
      return false;
    }

    return record.userId === this.activeUserId();
  }

  // =====================================
  // KIỂM TRA USER ID HỢP LỆ
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

}
