import {
  ParkingSessionService
} from './parking-session.service';
import {
  Injectable,
  computed,
  inject,
  signal
} from '@angular/core';

import {
  ParkingLotService,
  type FloorId,
  type ParkingSpot
} from './parking-lot.service';

import {
  DemoUserService,
  type DemoUserId
} from './demo-user.service';

import {
  DemoUserScopeService
} from './demo-user-scope.service';

import {
  overnightDatesInRange,
  firstOvernightWindow
} from './overnight-window.util';

export type OvernightStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export type OvernightOrigin =
  | 'manual'
  | 'booking';

export interface OvernightRequest {
  id: string;
  userId: DemoUserId | null;
  bookingId?: string | null;
  sessionId?: string | null;
  origin?: OvernightOrigin;
  plate: string;
  floor: FloorId;
  spot: ParkingSpot['id'];
  nightDate: string;
  reason: string;
  status: OvernightStatus;
  createdAt: string;
  
}

export interface NewOvernightRequest {
  plate: string;
  floor: FloorId;
  spot: ParkingSpot['id'];
  nightDate: string;
  reason: string;
}

export interface LinkedOvernightInput {
  bookingId: string;
  userId: DemoUserId;
  plate: string;
  floor: FloorId;
  spot: ParkingSpot['id'];
  nightDates: readonly string[];
  reason: string;
}

export interface OvernightResult {
  ok: boolean;
  message: string;
}

export interface LinkedOvernightPlan
  extends OvernightResult {
  additions: OvernightRequest[];
}

const STORAGE_KEY =
  'smart-parking-overnight-v1';

const ACTIVE_STATUSES: OvernightStatus[] = [
  'pending',
  'approved'
];

@Injectable({
  providedIn: 'root'
})
export class OvernightRequestService {

  private readonly parkingSessions = inject(
  ParkingSessionService
);

  private readonly scope = inject(
    DemoUserScopeService
  );

  private readonly lot = inject(
    ParkingLotService
  );

  private readonly users = inject(
  DemoUserService
  );

  readonly requests = signal<OvernightRequest[]>(
    this.load()
  );

  // Danh sách của user hiện tại.
  readonly myRequests = computed(() =>
    this.requests().filter(
      item =>
        item.userId === this.scope.activeUserId()
    )
  );

  // Thống kê toàn bãi dành cho Operator.
  readonly pendingCount = computed(() =>
    this.count(this.requests(), 'pending')
  );

  readonly approvedCount = computed(() =>
    this.count(this.requests(), 'approved')
  );

  readonly rejectedCount = computed(() =>
    this.count(this.requests(), 'rejected')
  );

  readonly cancelledCount = computed(() =>
    this.count(this.requests(), 'cancelled')
  );

  // Thống kê riêng từng user.
  readonly myPendingCount = computed(() =>
    this.count(this.myRequests(), 'pending')
  );

  readonly myApprovedCount = computed(() =>
    this.count(this.myRequests(), 'approved')
  );

  readonly myRejectedCount = computed(() =>
    this.count(this.myRequests(), 'rejected')
  );

  readonly myCancelledCount = computed(() =>
    this.count(this.myRequests(), 'cancelled')
  );

  // =====================================
  // API TẠO YÊU CẦU THỦ CÔNG CŨ
  // =====================================


createRequest(
  input: NewOvernightRequest
): OvernightResult {

  // =====================================
  // XÁC ĐỊNH USER VÀ XE ĐANG GỬI
  // =====================================

  const userId = this.scope.activeUserId();

  const plate = this.users.activePlate();

  const session =
    this.parkingSessions.myActiveSession();

  if (!session) {

    return {
      ok: false,
      message:
        'Bạn hiện không có xe đang gửi trong bãi.'
    };

  }

  // Biển số phải thuộc User hiện tại.

  if (
    !this.users.isPlateOwnedByUser(
      input.plate,
      userId
    )
  ) {

    return {
      ok: false,
      message:
        'Biển số xe không thuộc tài khoản hiện tại.'
    };

  }

  // Không cho tự ý thay đổi vị trí đỗ.

  if (
    input.floor !== session.floor ||
    input.spot !== session.spot
  ) {

    return {
      ok: false,
      message:
        'Vị trí không khớp với xe đang gửi.'
    };

  }

  if (
    !this.validSpot(
      session.floor,
      session.spot
    )
  ) {

    return {
      ok: false,
      message:
        'Vị trí đỗ xe không hợp lệ.'
    };

  }

  // =====================================
  // KIỂM TRA NGÀY QUA ĐÊM
  // =====================================

  const nightDate = input.nightDate.trim();

  const reason = input.reason.trim();

  if (!this.validNightDate(nightDate)) {

    return {
      ok: false,
      message:
        'Ngày gửi qua đêm không hợp lệ.'
    };

  }

  const firstNight = firstOvernightWindow(
    session.checkInAt
  );

  if (
    !firstNight ||
    nightDate < firstNight.nightDate
  ) {

    return {
      ok: false,
      message:
        'Ngày qua đêm không phù hợp ' +
        'với thời gian check-in.'
    };

  }

  // =====================================
  // KIỂM TRA LÝ DO
  // =====================================

  if (!reason || reason.length > 500) {

    return {
      ok: false,
      message:
        'Vui lòng nhập lý do từ 1 đến 500 ký tự.'
    };

  }

  // =====================================
  // CHỐNG TRÙNG YÊU CẦU
  // =====================================

  const duplicate = this.requests().some(
    item =>

      this.users.isPlateOwnedByUser(
        item.plate,
        userId
      ) &&

      item.nightDate === nightDate &&

      ACTIVE_STATUSES.includes(item.status)
  );

  if (duplicate) {

    return {
      ok: false,
      message:
        'Xe đã có yêu cầu đang chờ duyệt ' +
        'hoặc đã được duyệt cho đêm này.'
    };

  }

  // =====================================
  // TẠO YÊU CẦU
  // =====================================

  const request: OvernightRequest = {

    id: this.newId(),

    userId,

    bookingId: null,

    sessionId: session.id,

    origin: 'manual',

    plate,

    floor: session.floor,

    spot: session.spot,

    nightDate,

    reason,

    status: 'pending',

    createdAt: new Date().toISOString()

  };

  const updated = [

    request,

    ...this.requests()

  ];

  if (!this.persist(updated)) {

    return {
      ok: false,
      message:
        'Không thể lưu yêu cầu qua đêm.'
    };

  }

  this.requests.set(updated);

  return {
    ok: true,
    message:
      'Đã gửi yêu cầu qua đêm. ' +
      'Vui lòng chờ người điều hành duyệt.'
  };

}


  // =====================================
  // KIỂM TRA YÊU CẦU TỪ BOOKING
  // =====================================

  prepareForBooking(
    input: LinkedOvernightInput
  ): LinkedOvernightPlan {

    const fail = (
      message: string
    ): LinkedOvernightPlan => ({
      ok: false,
      message,
      additions: []
    });

    if (!this.validSpot(input.floor, input.spot)) {
      return fail(
        'Vị trí không tồn tại hoặc đang bảo trì.'
      );
    }

    const plate = input.plate
      .trim()
      .toUpperCase();

    const reason = input.reason.trim();

    if (
  input.userId !== this.scope.activeUserId() ||
  !this.users.isPlateOwnedByUser(
    plate,
    input.userId
  )
) {
  return fail(
    'Thông tin tài khoản hoặc biển số không hợp lệ.'
  );
}

    if (!reason) {
      return fail(
        'Vui lòng nhập lý do gửi qua đêm.'
      );
    }

    const dates = [
      ...new Set(input.nightDates)
    ];

    if (
      dates.length === 0 ||
      dates.some(date => !this.validNightDate(date))
    ) {
      return fail(
        'Danh sách ngày qua đêm không hợp lệ.'
      );
    }

    const additions: OvernightRequest[] = [];

    for (const date of dates) {

      // Tìm mọi yêu cầu còn hiệu lực
      // cùng biển số và đêm.
      const existing = this.requests().filter(
        item =>
          item.plate.toUpperCase() === plate &&
          item.nightDate === date &&
          ACTIVE_STATUSES.includes(item.status)
      );

      // Chặn yêu cầu của user khác,
      // chỗ khác, hoặc booking khác.
      const conflict = existing.some(
        item =>
          item.userId !== input.userId ||
          item.floor !== input.floor ||
          item.spot !== input.spot ||
          (
            item.origin === 'booking' &&
            item.bookingId !== input.bookingId
          )
      );

      if (conflict) {
        return fail(
          `Đêm ${date} đã có yêu cầu xung đột.`
        );
      }

      // Nếu cùng user đã gửi thủ công
      // cho chính xe/chỗ/đêm này,
      // dùng lại thay vì tạo trùng.
if (existing.length > 0) {

  return fail(
    `Xe đã có yêu cầu gửi qua đêm ngày ${date}.`
  );

}

      additions.push({
        id: this.newId(),
        userId: input.userId,
        bookingId: input.bookingId,
        origin: 'booking',
        plate,
        floor: input.floor,
        spot: input.spot,
        nightDate: date,
        reason,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
    }

    return {
      ok: true,
      message: 'Đã kiểm tra các đêm cần xin phép.',
      additions
    };
  }

  // =====================================
  // GHI CÁC YÊU CẦU ĐÃ KIỂM TRA
  // =====================================

  commitForBooking(
    plan: LinkedOvernightPlan
  ): boolean {

    if (!plan.ok) {
      return false;
    }

    if (plan.additions.length === 0) {
      return true;
    }

    const updated = [
      ...plan.additions,
      ...this.requests()
    ];

    if (!this.persist(updated)) {
      return false;
    }

    this.requests.set(updated);

    return true;
  }

  // =====================================
  // THU HỒI YÊU CẦU TỰ SINH
  // =====================================

  closeForBooking(
    bookingId: string,
    event: 'cancelled' | 'rejected'
  ): boolean {

    let changed = false;

    const updated = this.requests().map(item => {

      if (
        item.origin !== 'booking' ||
        item.bookingId !== bookingId ||
        !ACTIVE_STATUSES.includes(item.status)
      ) {
        return item;
      }

      changed = true;

      const status: OvernightStatus =
        item.status === 'approved'
          ? 'cancelled'
          : event;

      return {
        ...item,
        status
      };
    });

    if (!changed) {
      return true;
    }

    if (!this.persist(updated)) {
      return false;
    }

    this.requests.set(updated);

    return true;
  }

  // =====================================
  // YÊU CẦU QUA ĐÊM CỦA MỘT BOOKING
  // =====================================


forBooking(booking: {
  id: string;
  userId: DemoUserId | null;
  plate: string;
  floor: FloorId;
  spot: ParkingSpot['id'];
  startAt: string;
  endAt: string;
}): OvernightRequest[] {

  // Chỉ truy xuất yêu cầu của user hiện tại.

  if (
    booking.userId !== this.scope.activeUserId()
  ) {
    return [];
  }

  // Khoảng thời gian chỉ dùng cho booking cũ.

  const legacyDates = booking.endAt

    ? overnightDatesInRange(
        booking.startAt,
        booking.endAt
      )

    : [];

  return this.myRequests()

    .filter(item => {

      // Booking mới liên kết trực tiếp
      // thông qua bookingId.

      if (
        item.origin === 'booking' && !item.sessionId &&
        item.bookingId === booking.id
      ) {
        return true;
      }

      // Tương thích các yêu cầu thủ công
      // đã được tạo trong phiên bản cũ.

      return (
        item.origin !== 'booking' &&

        legacyDates.includes(item.nightDate) &&

        item.plate.toUpperCase() ===
          booking.plate.toUpperCase() &&

        item.floor === booking.floor &&

        item.spot === booking.spot
      );

    })

    .sort(
      (a, b) =>
        a.nightDate.localeCompare(b.nightDate)
    );

}


  // =====================================
  // OPERATOR DUYỆT / TỪ CHỐI
  // =====================================

  approveRequest(
    id: string
  ): OvernightResult {

    return this.updateStatus(id, 'approved');
  }

  rejectRequest(
    id: string
  ): OvernightResult {

    return this.updateStatus(id, 'rejected');
  }

  // =====================================
  // HỦY YÊU CẦU THỦ CÔNG
  // =====================================

  cancelRequest(
    id: string
  ): OvernightResult {

    const request = this.requests().find(
      item => item.id === id
    );

    if (
      !request ||
      request.userId !== this.scope.activeUserId()
    ) {
      return {
        ok: false,
        message: 'Bạn không có quyền hủy yêu cầu này.'
      };
    }

    if (request.origin === 'booking') {
      return {
        ok: false,
        message:
          'Yêu cầu đi kèm booking. Hãy hủy booking.'
      };
    }

    if (request.status !== 'pending') {
      return {
        ok: false,
        message: 'Chỉ được hủy yêu cầu chờ duyệt.'
      };
    }

    const updated = this.requests().map(
      item =>
        item.id === id
          ? {
              ...item,
              status: 'cancelled' as OvernightStatus
            }
          : item
    );

    if (!this.persist(updated)) {
      return {
        ok: false,
        message: 'Không thể lưu thao tác hủy.'
      };
    }

    this.requests.set(updated);

    return {
      ok: true,
      message: 'Đã hủy yêu cầu qua đêm.'
    };
  }

  // =====================================
  // CẬP NHẬT TRẠNG THÁI
  // =====================================

  private updateStatus(
    id: string,
    status: 'approved' | 'rejected'
  ): OvernightResult {

    const request = this.requests().find(
      item => item.id === id
    );

    if (
      !request ||
      request.status !== 'pending'
    ) {
      return {
        ok: false,
        message:
          'Yêu cầu không tồn tại hoặc đã xử lý.'
      };
    }

    const updated = this.requests().map(
      item =>
        item.id === id
          ? { ...item, status }
          : item
    );

    if (!this.persist(updated)) {
      return {
        ok: false,
        message: 'Không thể lưu kết quả duyệt.'
      };
    }

    this.requests.set(updated);

    return {
      ok: true,
      message:
        status === 'approved'
          ? 'Đã duyệt gửi xe qua đêm.'
          : 'Đã từ chối gửi xe qua đêm.'
    };
  }

  // =====================================
  // HÀM HỖ TRỢ
  // =====================================

  private count(
    items: OvernightRequest[],
    status: OvernightStatus
  ): number {

    return items.filter(
      item => item.status === status
    ).length;
  }

  private validSpot(
    floor: FloorId,
    spotId: string
  ): boolean {

    return this.lot.spotsOnFloor(floor).some(
      item =>
        item.id === spotId &&
        item.status !== 'maintenance'
    );
  }

  private validNightDate(
    value: string
  ): boolean {

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }

    const date = new Date(
      `${value}T00:00:00`
    );

    const [year, month, day] =
      value.split('-').map(Number);

    return (
      Number.isFinite(date.getTime()) &&
      date.getFullYear() === year &&
      date.getMonth() + 1 === month &&
      date.getDate() === day
    );
  }

  private newId(): string {

    return (
      `overnight-${Date.now()}-` +
      Math.random().toString(36).slice(2, 9)
    );
  }

  // =====================================
  // ĐỌC DỮ LIỆU CŨ
  // =====================================

  private load(): OvernightRequest[] {

    try {

      if (typeof localStorage === 'undefined') {
        return [];
      }

      const raw = localStorage.getItem(
        STORAGE_KEY
      );

      if (!raw) {
        return [];
      }

      const parsed: unknown = JSON.parse(raw);

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter(item => {

          if (
            typeof item !== 'object' ||
            item === null
          ) {
            return false;
          }

          const x =
            item as Record<string, unknown>;

          return (
            typeof x['id'] === 'string' &&
            typeof x['plate'] === 'string' &&
            (x['floor'] === 'B1' ||
             x['floor'] === 'B2') &&
            typeof x['spot'] === 'string' &&
            typeof x['nightDate'] === 'string' &&
            typeof x['reason'] === 'string' &&
            typeof x['createdAt'] === 'string' &&
            (
              x['status'] === 'pending' ||
              x['status'] === 'approved' ||
              x['status'] === 'rejected' ||
              x['status'] === 'cancelled'
            )
          );

        })
        .map(item => {

          const x =
            item as Record<string, unknown>;

          return {
            id: x['id'] as string,

            userId: this.scope.isValidUserId(
              x['userId']
            )
              ? x['userId']
              : null,

            bookingId:
              typeof x['bookingId'] === 'string'
                ? x['bookingId']
                : null,
            sessionId:
              typeof x['sessionId'] === 'string'
                ? x['sessionId']
                : null,
            origin:
              x['origin'] === 'booking'
                ? 'booking' as const
                : 'manual' as const,

            plate: x['plate'] as string,
            floor: x['floor'] as FloorId,
            spot: x['spot'] as string,
            nightDate: x['nightDate'] as string,
            reason: x['reason'] as string,
            status: x['status'] as OvernightStatus,
            createdAt: x['createdAt'] as string
          };

        });

    } catch (error) {

      console.error(
        'Không thể đọc yêu cầu qua đêm:',
        error
      );

      return [];
    }
  }

  // =====================================
  // LƯU LOCALSTORAGE
  // =====================================

  private persist(
    next: OvernightRequest[]
  ): boolean {

    try {

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(next)
        );
      }

      return true;

    } catch (error) {

      console.error(
        'Không thể lưu yêu cầu qua đêm:',
        error
      );

      return false;
    }
  }

}
