
import {
  Injectable,
  computed,
  inject,
  signal
} from '@angular/core';

import {
  HttpErrorResponse
} from '@angular/common/http';

import {
  firstValueFrom
} from 'rxjs';

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
  OvernightRequestService,
  type LinkedOvernightPlan
} from './overnight-request.service';

import {
  overnightDatesInRange,
  firstOvernightWindow
} from './overnight-window.util';

import {
  ReservationApiService,
  type ReservationApiResponse,
  type ReservationApiStatus
} from './reservation-api.service';

import {
  ParkingSpotsApiService
} from './parking-spots-api.service';


// =====================================
// TRẠNG THÁI BOOKING
// =====================================

export type BookingStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'checked_in'
  | 'completed';


// =====================================
// DỮ LIỆU BOOKING FRONTEND
// =====================================

export interface ParkingBookingRequest {

  // Dùng reservationCode làm ID
  // để liên kết với OvernightRequestService.

  id: string;

  userId: DemoUserId | null;

  floor: FloorId;

  spot: ParkingSpot['id'];

  plate: string;

  startAt: string;

  // NULL từ Backend chuyển thành chuỗi rỗng.

  endAt: string;

  status: BookingStatus;

  createdAt: string;

}


// =====================================
// REQUEST TẠO BOOKING
// =====================================

export interface NewBookingRequest {

  floor: FloorId;

  spot: ParkingSpot['id'];

  from: string;

  overnightDate?: string;

  overnightReason?: string;

}


// =====================================
// KẾT QUẢ NGHIỆP VỤ
// =====================================

export interface BookingResult {

  ok: boolean;

  message: string;

}


// =====================================
// BOOKING REQUEST SERVICE
// =====================================

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

  private readonly api = inject(
    ReservationApiService
  );

  private readonly spotsApi = inject(
    ParkingSpotsApiService
  );


  // =====================================
  // DANH SÁCH RESERVATION
  // =====================================

  readonly requests = signal<
    ParkingBookingRequest[]
  >([]);


  readonly loading = signal(false);

  readonly loadError = signal('');


  // =====================================
  // DANH SÁCH CỦA CUSTOMER HIỆN TẠI
  // =====================================

  readonly myRequests = computed(() => {

    const userId = this.scope.activeUserId();

    return this.requests().filter(
      item => item.userId === userId
    );

  });


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


  // =====================================
  // LẤY RESERVATION TOÀN HỆ THỐNG
  // DÀNH CHO OPERATOR
  // =====================================

  async refreshAll(): Promise<BookingResult> {

    this.loading.set(true);

    this.loadError.set('');

    try {

      const response = await firstValueFrom(
        this.api.getAll()
      );

      const bookings = response.map(
        item => this.toBooking(item)
      );

      this.requests.set(bookings);

      return {
        ok: true,
        message: 'Đã cập nhật danh sách đặt chỗ.'
      };

    } catch (error) {

      const message = this.apiErrorMessage(
        error,
        'Không thể tải danh sách đặt chỗ.'
      );

      this.loadError.set(message);

      return {
        ok: false,
        message
      };

    } finally {

      this.loading.set(false);

    }

  }


  // =====================================
  // LẤY RESERVATION CỦA USER
  // =====================================

  async refreshMine(): Promise<BookingResult> {

    this.loading.set(true);

    this.loadError.set('');

    try {

      const userCode =
        this.scope.activeUserId();

      const response = await firstValueFrom(
        this.api.getByUser(userCode)
      );

      const bookings = response.map(
        item => this.toBooking(item, userCode)
      );

      this.requests.set(bookings);

      return {
        ok: true,
        message: 'Đã cập nhật yêu cầu của bạn.'
      };

    } catch (error) {

      const message = this.apiErrorMessage(
        error,
        'Không thể tải yêu cầu đặt chỗ.'
      );

      this.loadError.set(message);

      return {
        ok: false,
        message
      };

    } finally {

      this.loading.set(false);

    }

  }


  // =====================================
  // GIỮ API TÍNH NGÀY QUA ĐÊM CŨ
  // =====================================

  getOvernightDates(
    from: string,
    to: string
  ): string[] {

    return overnightDatesInRange(from, to);

  }


  // =====================================
  // TẠO YÊU CẦU ĐẶT CHỖ
  // =====================================

  async createRequest(
    input: NewBookingRequest
  ): Promise<BookingResult> {

    try {

      // 1. XÁC ĐỊNH USER

      const userCode =
        this.scope.activeUserId();

      const userId = userCode;

      const plate =
        this.users.activePlate();


      // 2. KIỂM TRA TẦNG

      if (
        input.floor !== 'B1' &&
        input.floor !== 'B2'
      ) {

        return {
          ok: false,
          message: 'Tầng đỗ xe không hợp lệ.'
        };

      }


      // 3. KIỂM TRA VỊ TRÍ TRÊN FRONTEND

      const localSpot = this.parkingLot
        .spotsOnFloor(input.floor)
        .find(item => item.id === input.spot);

      if (!localSpot) {

        return {
          ok: false,
          message: 'Vị trí đỗ xe không hợp lệ.'
        };

      }


      // 4. KIỂM TRA THỜI GIAN

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

      // Giữ nguyên giờ địa phương.
      // Không dùng toISOString() vì sẽ đổi múi giờ.

      const startTime = this.toLocalDateTime(
        input.from
      );

      if (!startTime) {

        return {
          ok: false,
          message:
            'Không thể chuyển đổi thời gian đặt chỗ.'
        };

      }


      // 5. ĐỌC RESERVATION CỦA USER TỪ BACKEND

      const mineResponse = await firstValueFrom(
        this.api.getByUser(userCode)
      );

      const mine = mineResponse.map(
        item => this.toBooking(item, userCode)
      );

      this.requests.set(mine);


      // 6. KIỂM TRA USER ĐANG CÓ BOOKING PENDING

      const userHasPending = mine.some(
        item => item.status === 'pending'
      );

      if (userHasPending) {

        return {
          ok: false,
          message:
            'Bạn đang có yêu cầu đặt chỗ chờ duyệt.'
        };

      }


      // 7. LẤY ID VỊ TRÍ THỰC TẾ TỪ DATABASE

      const backendSpots = await firstValueFrom(
        this.spotsApi.getSpots()
      );

      const backendSpot = backendSpots.find(
        item =>
          item.floor.toUpperCase() === input.floor &&
          item.spot.toUpperCase() ===
            input.spot.toUpperCase()
      );

      if (!backendSpot) {

        return {
          ok: false,
          message:
            'Không tìm thấy vị trí trong Backend.'
        };

      }


      // 8. KIỂM TRA TRẠNG THÁI VỊ TRÍ BACKEND

      const backendStatus =
        backendSpot.status.toUpperCase();

      if (
        backendStatus !== 'AVAILABLE' &&
        backendStatus !== 'RESERVED'
      ) {

        return {
          ok: false,
          message:
            'Vị trí này hiện không khả dụng.'
        };

      }


      // 9. KIỂM TRA YÊU CẦU QUA ĐÊM

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


      // 10. CHUẨN BỊ YÊU CẦU QUA ĐÊM

      let overnightPlan: LinkedOvernightPlan | null =
        null;

      const draftBookingId =
        `draft-${Date.now()}-` +
        Math.random().toString(36).slice(2, 8);

      if (nightDates.length > 0) {

        overnightPlan =
          this.overnight.prepareForBooking({

            bookingId: draftBookingId,

            userId,

            plate,

            floor: input.floor,

            spot: input.spot,

            nightDates,

            reason: overnightReason

          });

        if (!overnightPlan.ok) {

          return {
            ok: false,
            message: overnightPlan.message
          };

        }

      }


      // =====================================
      // 11. TẠO RESERVATION TRÊN BACKEND
      // =====================================

      const created = await firstValueFrom(
        this.api.create({

          userCode,

          spotId: backendSpot.id,

          startTime,

          endTime: null,

          phone: null,

          overnightRequested:
            nightDates.length > 0

        })
      );


      // =====================================
      // 12. CHUYỂN RESPONSE BACKEND
      // THÀNH DỮ LIỆU FRONTEND
      // =====================================

      const booking = this.toBooking(
        created,
        userId
      );

      this.upsertBooking(booking);


      // =====================================
      // 13. LIÊN KẾT YÊU CẦU QUA ĐÊM
      // VỚI RESERVATION CODE THỰC TẾ
      // =====================================

      if (
        overnightPlan &&
        overnightPlan.additions.length > 0
      ) {

        const linkedPlan: LinkedOvernightPlan = {

          ...overnightPlan,

          additions:
            overnightPlan.additions.map(item => ({
              ...item,
              bookingId: created.reservationCode
            }))

        };

        const committed =
          this.overnight.commitForBooking(
            linkedPlan
          );

        if (!committed) {

          return {
            ok: true,
            message:
              'Đã tạo đặt chỗ thành công. ' +
              'Tuy nhiên, chi tiết yêu cầu qua đêm ' +
              'chưa lưu được. Vui lòng kiểm tra lại.'
          };

        }

      }


      // =====================================
      // 14. THÔNG BÁO KẾT QUẢ
      // =====================================

      return {

        ok: true,

        message: nightDates.length > 0

          ? 'Đã gửi yêu cầu đặt chỗ và gửi xe qua đêm. Vui lòng chờ duyệt.'

          : 'Đã gửi yêu cầu đặt chỗ thành công. Vui lòng chờ duyệt.'

      };

    } catch (error) {

      return {

        ok: false,

        message: this.apiErrorMessage(
          error,
          'Không thể tạo yêu cầu đặt chỗ.'
        )

      };

    }

  }


  // =====================================
  // OPERATOR DUYỆT RESERVATION
  // =====================================

  async approveRequest(
    id: string
  ): Promise<BookingResult> {

    const booking = this.requests().find(
      item => item.id === id
    );

    if (
      !booking ||
      booking.status !== 'pending'
    ) {

      return {
        ok: false,
        message: 'Booking không hợp lệ hoặc đã được xử lý.'
      };

    }

    try {

      const response = await firstValueFrom(
        this.api.confirm(booking.id)
      );

      this.upsertBooking(
        this.toBooking(response, booking.userId ?? undefined)
      );

      return {
        ok: true,
        message: 'Đã duyệt yêu cầu đặt chỗ.'
      };

    } catch (error) {

      return {
        ok: false,
        message: this.apiErrorMessage(
          error,
          'Không thể duyệt yêu cầu đặt chỗ.'
        )
      };

    }

  }


  // =====================================
  // OPERATOR TỪ CHỐI RESERVATION
  // =====================================

  async rejectRequest(
    id: string
  ): Promise<BookingResult> {

    const booking = this.requests().find(
      item => item.id === id
    );

    if (
      !booking ||
      booking.status !== 'pending'
    ) {

      return {
        ok: false,
        message: 'Booking không hợp lệ hoặc đã được xử lý.'
      };

    }

    try {

      const response = await firstValueFrom(
        this.api.reject(booking.id)
      );

      this.upsertBooking(
        this.toBooking(response, booking.userId ?? undefined)
      );

      const overnightClosed =
        this.overnight.closeForBooking(
          booking.id,
          'rejected'
        );

      return {

        ok: true,

        message: overnightClosed

          ? 'Đã từ chối đặt chỗ và thu hồi yêu cầu qua đêm đi kèm.'

          : 'Đã từ chối đặt chỗ. Tuy nhiên, yêu cầu qua đêm đi kèm chưa đồng bộ được.'

      };

    } catch (error) {

      return {
        ok: false,
        message: this.apiErrorMessage(
          error,
          'Không thể từ chối yêu cầu đặt chỗ.'
        )
      };

    }

  }


  // =====================================
  // CUSTOMER HỦY RESERVATION
  // =====================================

  async cancelRequest(
    id: string
  ): Promise<BookingResult> {

    const booking = this.requests().find(
      item => item.id === id
    );

    if (!booking) {

      return {
        ok: false,
        message: 'Không tìm thấy booking.'
      };

    }

    const userCode = this.scope.activeUserId();

    if (
      booking.userId === null ||
      booking.userId !== userCode
    ) {

      return {
        ok: false,
        message:
          'Bạn không có quyền hủy booking này.'
      };

    }

    if (booking.status !== 'pending') {

      return {
        ok: false,
        message:
          'Chỉ được hủy booking đang chờ duyệt.'
      };

    }

    try {

      const response = await firstValueFrom(
        this.api.cancel(
          booking.id,
          userCode
        )
      );

      this.upsertBooking(
        this.toBooking(response, userCode)
      );

      const overnightClosed =
        this.overnight.closeForBooking(
          booking.id,
          'cancelled'
        );

      return {

        ok: true,

        message: overnightClosed

          ? 'Đã hủy booking và yêu cầu qua đêm đi kèm.'

          : 'Đã hủy booking. Yêu cầu qua đêm đi kèm chưa đồng bộ được.'

      };

    } catch (error) {

      return {
        ok: false,
        message: this.apiErrorMessage(
          error,
          'Không thể hủy yêu cầu đặt chỗ.'
        )
      };

    }

  }


  // =====================================
  // ÁNH XẠ RESPONSE BACKEND
  // SANG FRONTEND
  // =====================================

  private toBooking(
    response: ReservationApiResponse,
    fallbackUserId?: DemoUserId
  ): ParkingBookingRequest {

    if (
      response.floor !== 'B1' &&
      response.floor !== 'B2'
    ) {

      throw new Error(
        `Tầng không hợp lệ: ${response.floor}`
      );

    }

    const owner =
      this.users.getUserByPlate(
        response.licensePlate
      );

    return {

      // Không sử dụng ID giả REQ-...
      // Dùng reservationCode thực tế.

      id: response.reservationCode,

      userId:
        fallbackUserId ??
        owner?.id ??
        null,

      floor: response.floor,

      spot: response.spot,

      plate: response.licensePlate,

      startAt: response.startTime,

      endAt: response.endTime ?? '',

      status: this.mapStatus(response.status),

      createdAt: response.createdAt

    };

  }


  // =====================================
  // ÁNH XẠ TRẠNG THÁI
  // =====================================

  private mapStatus(
    status: ReservationApiStatus
  ): BookingStatus {

    switch (status) {

      case 'PENDING':
        return 'pending';

      case 'CONFIRMED':
        return 'approved';

      case 'REJECTED':
        return 'rejected';

      case 'CANCELLED':
        return 'cancelled';

      case 'CHECKED_IN':
        return 'checked_in';

      case 'COMPLETED':
        return 'completed';

    }

  }


  // =====================================
  // CẬP NHẬT SIGNAL
  // =====================================

  private upsertBooking(
    booking: ParkingBookingRequest
  ): void {

    this.requests.update(current => {

      const index = current.findIndex(
        item => item.id === booking.id
      );

      const updated = [...current];

      if (index === -1) {

        updated.unshift(booking);

      } else {

        updated[index] = booking;

      }

      return updated.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      );

    });

  }


  // =====================================
  // ĐỊNH DẠNG LOCALDATETIME
  // KHÔNG CHUYỂN SANG UTC
  // =====================================

  private toLocalDateTime(
    value: string
  ): string | null {

    const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/
      .exec(value.trim());

    if (!match) {
      return null;
    }

    return `${match[1]}T${match[2]}:${match[3] ?? '00'}`;

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
  // ĐỌC LỖI TỪ BACKEND
  // =====================================

  private apiErrorMessage(
    error: unknown,
    fallback: string
  ): string {

    if (error instanceof HttpErrorResponse) {

      if (typeof error.error === 'string'
          && error.error.trim()) {

        return error.error;

      }

      if (
        error.error &&
        typeof error.error === 'object'
      ) {

        const body = error.error as {
          message?: unknown;
          detail?: unknown;
        };

        if (
          typeof body.message === 'string' &&
          body.message.trim()
        ) {
          return body.message;
        }

        if (
          typeof body.detail === 'string' &&
          body.detail.trim()
        ) {
          return body.detail;
        }

      }

      if (error.status === 0) {

        return 'Không thể kết nối Backend. Vui lòng kiểm tra Spring Boot.';

      }

    }

    if (error instanceof Error) {
      console.error(error);
    }

    return fallback;

  }

}
