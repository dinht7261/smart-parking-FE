
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
  OvernightRequestService
} from './overnight-request.service';

import {
  overnightDatesInRange,
  firstOvernightWindow
} from './overnight-window.util';


export type BookingStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export interface ParkingBookingRequest {
  id: string;
  userId: DemoUserId | null;
  floor: FloorId;
  spot: ParkingSpot['id'];
  plate: string;

  // Ngày giờ dự kiến gửi xe.
  startAt: string;

  // Giữ để tương thích code và dữ liệu cũ.
  // Booking mới luôn có endAt = ''.
  endAt: string;

  status: BookingStatus;
  createdAt: string;
}

export interface NewBookingRequest {
  floor: FloorId;
  spot: ParkingSpot['id'];
  from: string;

  // Yêu cầu qua đêm do user chủ động chọn.
  overnightDate?: string;
  overnightReason?: string;
}

export interface BookingResult {
  ok: boolean;
  message: string;
}

const STORAGE_KEY =
  'smart-parking-bookings-v1';

@Injectable({
  providedIn: 'root'
})
export class BookingRequestService {

  private readonly parkingLot = inject(
    ParkingLotService
  );

  private readonly scope = inject(
    DemoUserScopeService
  );

  private readonly users = inject(
    DemoUserService
  );

  private readonly overnight = inject(
    OvernightRequestService
  );

  // =====================================
  // DANH SÁCH BOOKING
  // =====================================

  readonly requests = signal<
    ParkingBookingRequest[]
  >(this.load());

  readonly myRequests = computed(() =>
    this.requests().filter(
      item =>
        item.userId === this.scope.activeUserId()
    )
  );

  // =====================================
  // THỐNG KÊ OPERATOR
  // =====================================

  readonly pendingCount = computed(() =>
    this.count(this.requests(), 'pending')
  );

  readonly approvedCount = computed(() =>
    this.count(this.requests(), 'approved')
  );

  readonly rejectedCount = computed(() =>
    this.count(this.requests(), 'rejected')
  );

  // =====================================
  // THỐNG KÊ CUSTOMER
  // =====================================

  readonly myPendingCount = computed(() =>
    this.count(this.myRequests(), 'pending')
  );

  readonly myApprovedCount = computed(() =>
    this.count(this.myRequests(), 'approved')
  );

  readonly myRejectedCount = computed(() =>
    this.count(this.myRequests(), 'rejected')
  );

  // Giữ API cũ để tương thích.
  getOvernightDates(
    from: string,
    to: string
  ): string[] {

    return overnightDatesInRange(from, to);

  }

  // =====================================
  // TẠO YÊU CẦU ĐẶT CHỖ
  // =====================================

  createRequest(
    input: NewBookingRequest
  ): BookingResult {

    // Tự động nhận diện tài khoản và biển số.

    const userId = this.scope.activeUserId();

    const plate = this.users.activePlate();

    // Kiểm tra vị trí.

    const spot = this.parkingLot
      .spotsOnFloor(input.floor)
      .find(item => item.id === input.spot);

    if (!spot || spot.status !== 'available') {

      return {
        ok: false,
        message: 'Vị trí này không còn khả dụng.'
      };

    }

    // Kiểm tra ngày giờ dự kiến gửi xe.

    const start = new Date(input.from);

    if (
      !Number.isFinite(start.getTime()) ||
      start.getTime() < Date.now()
    ) {

      return {
        ok: false,
        message:
          'Ngày giờ dự kiến gửi xe không hợp lệ.'
      };

    }

    // Không cho đặt trùng vị trí đang chờ duyệt.

    const alreadyPending =
      this.requests().some(item =>
        item.floor === input.floor &&
        item.spot === input.spot &&
        item.status === 'pending'
      );

    if (alreadyPending) {

      return {
        ok: false,
        message:
          'Vị trí này đang có yêu cầu chờ duyệt.'
      };

    }

    // Một user không gửi đồng thời
    // nhiều yêu cầu đặt chỗ đang chờ.

    const userHasPending =
      this.requests().some(item =>
        item.userId === userId &&
        item.status === 'pending'
      );

    if (userHasPending) {

      return {
        ok: false,
        message:
          'Bạn đang có yêu cầu đặt chỗ chờ duyệt.'
      };

    }

    // =====================================
    // KIỂM TRA YÊU CẦU QUA ĐÊM
    // =====================================


const overnightDate =
  (input.overnightDate ?? '').trim();

const overnightReason =
  (input.overnightReason ?? '').trim();

const nightDates: string[] = [];

if (overnightDate || overnightReason) {

  if (!overnightReason) {

    return {
      ok: false,
      message:
        'Vui lòng nhập lý do gửi xe qua đêm.'
    };

  }

  const window = firstOvernightWindow(start);

  if (!window) {

    return {
      ok: false,
      message:
        'Không thể xác định thời gian qua đêm.'
    };

  }

  // Không chấp nhận ngày qua đêm
  // khác với đêm đầu tiên của booking.

  if (
    overnightDate &&
    overnightDate !== window.nightDate
  ) {

    return {
      ok: false,
      message:
        'Ngày gửi qua đêm không hợp lệ.'
    };

  }

  nightDates.push(window.nightDate);

}


    // =====================================
    // KHỞI TẠO BOOKING
    // =====================================

    const booking: ParkingBookingRequest = {

      id:
        `REQ-${Date.now()}-` +
        Math.random().toString(36).slice(2, 9),

      userId,
      plate,

      floor: input.floor,
      spot: input.spot,

      startAt: start.toISOString(),

      // Không còn ngày giờ lấy xe dự kiến.
      endAt: '',

      status: 'pending',

      createdAt: new Date().toISOString()

    };

    // =====================================
    // CHUẨN BỊ YÊU CẦU QUA ĐÊM
    // =====================================

    const plan = nightDates.length > 0

      ? this.overnight.prepareForBooking({

          bookingId: booking.id,
          userId,
          plate,

          floor: booking.floor,
          spot: booking.spot,

          nightDates,

          reason: overnightReason

        })

      : {
          ok: true,
          message: '',
          additions: []
        };

    if (!plan.ok) {

      return {
        ok: false,
        message: plan.message
      };

    }

    // =====================================
    // LƯU BOOKING VÀ QUA ĐÊM
    // =====================================

    const before = this.requests();

    const updated = [
      booking,
      ...before
    ];

    if (!this.persist(updated)) {

      return {
        ok: false,
        message: 'Không thể lưu booking.'
      };

    }

    if (!this.overnight.commitForBooking(plan)) {

      this.persist(before);

      return {
        ok: false,
        message:
          'Không thể lưu yêu cầu qua đêm. ' +
          'Booking chưa được tạo thành công.'
      };

    }

    this.requests.set(updated);

    return {
      ok: true,

      message: nightDates.length > 0

        ? 'Đã gửi yêu cầu đặt chỗ và gửi xe qua đêm.'

        : 'Đã gửi yêu cầu đặt chỗ. Vui lòng chờ duyệt.'
    };

  }

  // =====================================
  // OPERATOR DUYỆT
  // =====================================

  approveRequest(id: string): BookingResult {

    const booking = this.requests().find(
      item => item.id === id
    );

    if (!booking || booking.status !== 'pending') {

      return {
        ok: false,
        message: 'Booking không hợp lệ.'
      };

    }

    const before = this.requests();

    const updated = before.map(item =>
      item.id === id
        ? {
            ...item,
            status: 'approved' as BookingStatus
          }
        : item
    );

    if (!this.persist(updated)) {

      return {
        ok: false,
        message: 'Không thể lưu kết quả duyệt.'
      };

    }

    const reserved = this.parkingLot.reserveSpot(
      booking.floor,
      booking.spot
    );

    if (!reserved) {

      this.persist(before);

      return {
        ok: false,
        message: 'Vị trí không còn trống.'
      };

    }

    this.requests.set(updated);

    return {
      ok: true,
      message: 'Đã duyệt yêu cầu đặt chỗ.'
    };

  }

  // =====================================
  // OPERATOR TỪ CHỐI
  // =====================================

  rejectRequest(id: string): BookingResult {

    const booking = this.requests().find(
      item => item.id === id
    );

    if (!booking || booking.status !== 'pending') {

      return {
        ok: false,
        message: 'Booking không hợp lệ.'
      };

    }

    return this.finishBooking(
      booking,
      'rejected'
    );

  }

  // =====================================
  // CUSTOMER HỦY BOOKING
  // =====================================

  cancelRequest(id: string): BookingResult {

    const booking = this.requests().find(
      item => item.id === id
    );

    if (!booking) {

      return {
        ok: false,
        message: 'Không tìm thấy booking.'
      };

    }

    if (
      booking.userId === null ||
      booking.userId !== this.scope.activeUserId()
    ) {

      return {
        ok: false,
        message: 'Bạn không có quyền hủy booking này.'
      };

    }

    if (booking.status !== 'pending') {

      return {
        ok: false,
        message: 'Chỉ được hủy booking chờ duyệt.'
      };

    }

    return this.finishBooking(
      booking,
      'cancelled'
    );

  }

  // =====================================
  // THU HỒI YÊU CẦU LIÊN QUAN
  // =====================================

  private finishBooking(
    booking: ParkingBookingRequest,
    status: 'cancelled' | 'rejected'
  ): BookingResult {

    const before = this.requests();

    const updated = before.map(item =>
      item.id === booking.id
        ? { ...item, status }
        : item
    );

    if (!this.persist(updated)) {

      return {
        ok: false,
        message: 'Không thể lưu trạng thái booking.'
      };

    }

    if (
      !this.overnight.closeForBooking(
        booking.id,
        status
      )
    ) {

      this.persist(before);

      return {
        ok: false,
        message:
          'Không thể thu hồi yêu cầu qua đêm.'
      };

    }

    this.requests.set(updated);

    return {
      ok: true,

      message: status === 'cancelled'

        ? 'Đã hủy booking và yêu cầu qua đêm đi kèm.'

        : 'Đã từ chối booking và thu hồi yêu cầu qua đêm.'
    };

  }

  // =====================================
  // HÀM THỐNG KÊ
  // =====================================

  private count(
    items: ParkingBookingRequest[],
    status: BookingStatus
  ): number {

    return items.filter(
      item => item.status === status
    ).length;

  }

  // =====================================
  // ĐỌC DỮ LIỆU CŨ
  // =====================================

  private load(): ParkingBookingRequest[] {

    try {

      if (typeof localStorage === 'undefined') {
        return [];
      }

      const raw =
        localStorage.getItem(STORAGE_KEY);

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

            (
              x['floor'] === 'B1' ||
              x['floor'] === 'B2'
            ) &&

            typeof x['spot'] === 'string' &&
            typeof x['plate'] === 'string' &&
            typeof x['startAt'] === 'string' &&
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

            floor: x['floor'] as FloorId,
            spot: x['spot'] as string,

            plate: x['plate'] as string,

            startAt: x['startAt'] as string,

            endAt:
              typeof x['endAt'] === 'string'
                ? x['endAt']
                : '',

            status: x['status'] as BookingStatus,

            createdAt: x['createdAt'] as string

          };

        });

    } catch (error) {

      console.error(
        'Không thể đọc dữ liệu booking:',
        error
      );

      return [];

    }

  }

  // =====================================
  // LƯU LOCALSTORAGE
  // =====================================

  private persist(
    next: ParkingBookingRequest[]
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
        'Không thể lưu booking:',
        error
      );

      return false;

    }

  }

}
