
import {
  Injectable,
  computed,
  inject
} from '@angular/core';

import {
  SimulationClockService
} from './simulation-clock.service';

import {
  BookingRequestService
} from './booking-request.service';

import {
  ParkingSessionService,
  type ParkingSession
} from './parking-session.service';

import {
  OvernightRequestService,
  type OvernightRequest,
  type OvernightStatus
} from './overnight-request.service';

// =====================================
// NGUỒN PHIÊN GỬI XE
// =====================================

// 'demo' chỉ được giữ để tương thích
// với các component cũ.
// Không còn tạo record mới mang nguồn 'demo'.

export type ViolationSource =
  | 'session'
  | 'booking'
  | 'demo';

export type OvernightApprovalStatus =
  | OvernightStatus
  | 'none';

export interface OvertimeRecord {

  id: string;

  source: ViolationSource;

  plate: string;
  floor: string;
  spot: string;

  checkInAt: string;
  checkOutAt: string | null;

  bookingEndAt: string | null;

  evaluatedAt: string;
  effectiveEndAt: string | null;

  nightDate: string;

  overnightStatus: OvernightApprovalStatus;

  isInOvernightPeriod: boolean;

  overnightViolation: boolean;
  overtimeViolation: boolean;

  started: boolean;
  isActive: boolean;
  isViolation: boolean;

  overdueMinutes: number;
  excessMinutes: number;
}

// =====================================
// CẤU HÌNH KIỂM TRA
// =====================================

// Ngưỡng 15 phút chỉ phục vụ
// phát hiện quá giờ booking.
// KHÔNG tự phát sinh phí phạt 15 phút.

const GRACE_MINUTES = 15;

const NIGHT_START_HOUR = 22;
const NIGHT_END_HOUR = 6;

@Injectable({
  providedIn: 'root'
})
export class ViolationService {

  private readonly clock = inject(
    SimulationClockService
  );

  private readonly bookings = inject(
    BookingRequestService
  );

  private readonly sessions = inject(
    ParkingSessionService
  );

  private readonly overnight = inject(
    OvernightRequestService
  );

  readonly graceMinutes = GRACE_MINUTES;

  // =====================================
  // DANH SÁCH ĐÁNH GIÁ VI PHẠM
  // =====================================

  // Không tạo xe mẫu.
  // Không tạo hồ sơ vi phạm mẫu.
  // Chỉ đánh giá những phiên đã tồn tại.

  readonly overtimeRecords = computed(() => {

    const now = this.clock.now();

    const approvedBookings =
      this.bookings.requests().filter(
        booking => booking.status === 'approved'
      );

    const overnightRequests =
      this.overnight.requests();

    const parkingSessions =
      this.sessions.sessions();

    const results: OvertimeRecord[] = [];

    for (const session of parkingSessions) {

      const checkInMs = new Date(
        session.checkInAt
      ).getTime();

      if (!Number.isFinite(checkInMs)) {
        continue;
      }

      // =====================================
      // TÌM BOOKING ĐÃ DUYỆT
      // =====================================

      const matchedBooking = approvedBookings.find(
        booking => {

          if (
            booking.plate.toUpperCase() !==
              session.plate.toUpperCase() ||
            booking.floor !== session.floor ||
            booking.spot !== session.spot
          ) {
            return false;
          }

          const bookingStartMs = new Date(
            booking.startAt
          ).getTime();

          const bookingEndMs = new Date(
            booking.endAt
          ).getTime();

          return (
            Number.isFinite(bookingStartMs) &&
            Number.isFinite(bookingEndMs) &&
            checkInMs >= bookingStartMs &&
            checkInMs <= bookingEndMs
          );

        }
      );

      results.push(
        this.evaluate(
          session,
          matchedBooking?.endAt ?? null,
          now,
          overnightRequests
        )
      );

    }

    return results;
  });

  // =====================================
  // THỐNG KÊ
  // =====================================

  readonly violationCount = computed(() =>
    this.overtimeRecords().filter(
      record => record.isViolation
    ).length
  );

  readonly validCount = computed(() =>
    this.overtimeRecords().filter(
      record => !record.isViolation
    ).length
  );

  // =====================================
  // ĐÁNH GIÁ MỘT PHIÊN GỬI XE
  // =====================================

  private evaluate(
    session: ParkingSession,
    bookingEndAt: string | null,
    now: Date,
    overnightRequests: OvernightRequest[]
  ): OvertimeRecord {

    const nowMs = now.getTime();

    const checkInMs = new Date(
      session.checkInAt
    ).getTime();

    const checkOutMs = session.checkOutAt
      ? new Date(session.checkOutAt).getTime()
      : null;

    const alreadyExited =
      checkOutMs !== null &&
      Number.isFinite(checkOutMs) &&
      checkOutMs <= nowMs;

    const evaluatedMs = alreadyExited
      ? checkOutMs!
      : nowMs;

    const started = nowMs >= checkInMs;

    // =====================================
    // XÁC ĐỊNH ĐÊM THEO THỜI GIAN XE VÀO
    // =====================================

    const nightBase = new Date(checkInMs);

    if (nightBase.getHours() < NIGHT_END_HOUR) {

      nightBase.setDate(
        nightBase.getDate() - 1
      );

    }

    const nightStart = new Date(nightBase);

    nightStart.setHours(
      NIGHT_START_HOUR,
      0,
      0,
      0
    );

    const nightEnd = new Date(nightStart);

    nightEnd.setDate(
      nightEnd.getDate() + 1
    );

    nightEnd.setHours(
      NIGHT_END_HOUR,
      0,
      0,
      0
    );

    const nightStartMs =
      nightStart.getTime();

    const nightEndMs =
      nightEnd.getTime();

    const nightDate =
      this.toLocalDate(nightStart);

    // =====================================
    // KIỂM TRA YÊU CẦU QUA ĐÊM
    // =====================================

    const matchingRequests =
      overnightRequests.filter(
        request =>
          request.plate.toUpperCase() ===
            session.plate.toUpperCase() &&
          request.floor === session.floor &&
          request.spot === session.spot &&
          request.nightDate === nightDate
      );

    const matchedRequest =
      matchingRequests.find(
        request => request.status === 'approved'
      ) ??
      matchingRequests.find(
        request => request.status === 'pending'
      ) ??
      matchingRequests[0];

    const overnightStatus: OvernightApprovalStatus =
      matchedRequest?.status ?? 'none';

    const isApproved =
      overnightStatus === 'approved';

    // =====================================
    // KIỂM TRA THỜI GIAN QUA ĐÊM
    // =====================================

    const overlapsNight =
      started &&
      checkInMs < nightEndMs &&
      evaluatedMs > nightStartMs;

    const overnightViolation =
      overlapsNight && !isApproved;

    // =====================================
    // XÁC ĐỊNH HẠN GỬI XE
    // =====================================

    const bookingEndMs = bookingEndAt
      ? new Date(bookingEndAt).getTime()
      : null;

    let effectiveEndMs: number | null =
      bookingEndMs !== null &&
      Number.isFinite(bookingEndMs)
        ? bookingEndMs
        : null;

    // Nếu được duyệt qua đêm,
    // cho phép gửi đến 06:00 hôm sau.

    if (isApproved) {

      effectiveEndMs = effectiveEndMs === null
        ? nightEndMs
        : Math.max(
            effectiveEndMs,
            nightEndMs
          );

    }

    // =====================================
    // PHÁT HIỆN QUÁ GIỜ BOOKING
    // =====================================

    const overdueMinutes =
      effectiveEndMs === null
        ? 0
        : Math.max(
            0,
            Math.floor(
              (evaluatedMs - effectiveEndMs) /
              60000
            )
          );

    const excessMinutes = Math.max(
      0,
      overdueMinutes - GRACE_MINUTES
    );

    const overtimeViolation =
      started &&
      effectiveEndMs !== null &&
      overdueMinutes > GRACE_MINUTES;

    const isViolation =
      overtimeViolation ||
      overnightViolation;

    const isInOvernightPeriod =
      overlapsNight &&
      evaluatedMs <= nightEndMs;

    // =====================================
    // TRẢ VỀ BẢN GHI ĐÁNH GIÁ
    // =====================================

    return {

      id: session.id,

      // Không sử dụng nguồn 'demo' nữa.
      source: bookingEndAt
        ? 'booking'
        : 'session',

      plate: session.plate,
      floor: session.floor,
      spot: session.spot,

      checkInAt: session.checkInAt,
      checkOutAt: session.checkOutAt,

      bookingEndAt,

      evaluatedAt: new Date(
        evaluatedMs
      ).toISOString(),

      effectiveEndAt: effectiveEndMs === null
        ? null
        : new Date(
            effectiveEndMs
          ).toISOString(),

      nightDate,

      overnightStatus,

      isInOvernightPeriod,
      overnightViolation,
      overtimeViolation,

      started,

      isActive:
        started && !alreadyExited,

      isViolation,

      overdueMinutes,
      excessMinutes

    };
  }

  // =====================================
  // ĐỊNH DẠNG NGÀY
  // =====================================

  private toLocalDate(
    date: Date
  ): string {

    const pad = (
      value: number
    ): string =>
      String(value).padStart(2, '0');

    return (
      date.getFullYear() + '-' +
      pad(date.getMonth() + 1) + '-' +
      pad(date.getDate())
    );
  }

}
