import {
  Injectable,
  computed,
  inject
} from '@angular/core';

import {
  ParkingSessionService,
  type ParkingSession
} from './parking-session.service';

import {
  OvernightRequestService,
  type OvernightRequest
} from './overnight-request.service';

import {
  SimulationClockService
} from './simulation-clock.service';

import {
  ParkingReceiptService
} from './parking-receipt.service';
// =====================================
// CHÍNH SÁCH GIÁ DEMO
// =====================================

// 5.000đ / giờ
const HOURLY_RATE = 5000;

// 100.000đ / đêm vi phạm
const OVERNIGHT_PENALTY = 100000;

const HOUR_MS = 60 * 60 * 1000;

// Khung giờ qua đêm: 22:00 - 06:00
const NIGHT_START_HOUR = 22;
const NIGHT_END_HOUR = 6;


// =====================================
// THÔNG TIN HÓA ĐƠN
// =====================================

export interface ParkingFeeRecord {

  sessionId: string;

  plate: string;
  floor: string;
  spot: string;

  checkInAt: string;
  checkOutAt: string | null;

  // Thời điểm kết thúc dùng để tính phí
  calculatedUntil: string;

  // Tổng thời gian thực tế
  parkedMinutes: number;

  // Số giờ tính tiền
  billableHours: number;

  // Phí gửi xe
  parkingFee: number;

  // Số đêm vi phạm
  violationNights: number;

  // Tiền phạt
  penaltyFee: number;

  // Tổng cộng
  totalFee: number;

  // Xe đã rời bãi hay chưa
  completed: boolean;
}


@Injectable({
  providedIn: 'root'
})
export class ParkingFeeService {
    
    private readonly receiptStore = inject(
  ParkingReceiptService
);

  private readonly sessionService = inject(
    ParkingSessionService
  );

  private readonly overnightService = inject(
    OvernightRequestService
  );

  private readonly clock = inject(
    SimulationClockService
  );

  // Giá để giao diện sử dụng
  readonly hourlyRate = HOURLY_RATE;

  readonly overnightPenalty = OVERNIGHT_PENALTY;


  // =====================================
  // TÍNH TOÁN TẤT CẢ HÓA ĐƠN
  // =====================================

// =====================================
// HÓA ĐƠN: TẠM TÍNH HOẶC ĐÃ CHỐT
// =====================================

readonly bills = computed<ParkingFeeRecord[]>(() => {

  const nowMs = this.clock.now().getTime();

  const sessions = this.sessionService.sessions();

  const overnightRequests =
    this.overnightService.requests();

  // Hóa đơn đã chốt được ưu tiên sử dụng
  const savedReceipts =
    this.receiptStore.receipts();

  return sessions
    .map(session => {

      const finalizedReceipt = savedReceipts.find(
        receipt =>
          receipt.sessionId === session.id
      );

      // Xe có hóa đơn đã chốt:
      // không tính lại tiền nữa.
      if (finalizedReceipt) {
        return finalizedReceipt;
      }

      // Xe chưa có hóa đơn đã chốt:
      // tiếp tục tạm tính.
      return this.calculateBill(
        session,
        nowMs,
        overnightRequests
      );

    })
    .filter(
      (bill): bill is ParkingFeeRecord =>
        bill !== null
    );
});


  // =====================================
  // TỔNG HỢP THỐNG KÊ
  // =====================================

  readonly totalParkingFee = computed(() =>
    this.bills().reduce(
      (total, bill) => total + bill.parkingFee,
      0
    )
  );

  readonly totalPenaltyFee = computed(() =>
    this.bills().reduce(
      (total, bill) => total + bill.penaltyFee,
      0
    )
  );

  readonly grandTotal = computed(() =>
    this.totalParkingFee() +
    this.totalPenaltyFee()
  );

  readonly violationCount = computed(() =>
    this.bills().filter(
      bill => bill.violationNights > 0
    ).length
  );


  // =====================================
  // TÍNH HÓA ĐƠN CHO MỘT LƯỢT XE
  // =====================================

  private calculateBill(
    session: ParkingSession,
    nowMs: number,
    overnightRequests: OvernightRequest[]
  ): ParkingFeeRecord | null {

    const checkInMs = new Date(
      session.checkInAt
    ).getTime();

    const checkOutMs = session.checkOutAt
      ? new Date(session.checkOutAt).getTime()
      : nowMs;

    // Không tính dữ liệu thời gian không hợp lệ
    if (
      !Number.isFinite(checkInMs) ||
      !Number.isFinite(checkOutMs)
    ) {
      return null;
    }

    // Không để thời gian tính phí nhỏ hơn check-in
    const endMs = Math.max(
      checkInMs,
      checkOutMs
    );

    const durationMs = endMs - checkInMs;

    const parkedMinutes = Math.floor(
      durationMs / 60000
    );

    // Làm tròn số giờ lên
    const billableHours = Math.ceil(
      durationMs / HOUR_MS
    );

    // Phí gửi xe bình thường
    const parkingFee =
      billableHours * HOURLY_RATE;

    // Đếm số đêm vi phạm
    const violationNights =
      this.countUnauthorizedNights(
        session,
        checkInMs,
        endMs,
        overnightRequests
      );

    // Tiền phạt qua đêm
    const penaltyFee =
      violationNights * OVERNIGHT_PENALTY;

    return {
      sessionId: session.id,

      plate: session.plate,

      floor: session.floor,

      spot: session.spot,

      checkInAt: session.checkInAt,

      checkOutAt: session.checkOutAt,

      calculatedUntil:
        new Date(endMs).toISOString(),

      parkedMinutes,

      billableHours,

      parkingFee,

      violationNights,

      penaltyFee,

      totalFee: parkingFee + penaltyFee,

      completed: session.checkOutAt !== null
    };
  }


  // =====================================
  // ĐẾM SỐ ĐÊM VI PHẠM
  // =====================================

  private countUnauthorizedNights(
    session: ParkingSession,
    checkInMs: number,
    endMs: number,
    overnightRequests: OvernightRequest[]
  ): number {

    let violations = 0;

    // Bắt đầu kiểm tra từ ngày trước ngày xe vào
    // để xử lý trường hợp xe vào lúc 01:00.
    const cursor = new Date(checkInMs);

    cursor.setHours(0, 0, 0, 0);
    cursor.setDate(cursor.getDate() - 1);

    while (cursor.getTime() <= endMs) {

      // Bắt đầu đêm: 22:00
      const nightStart = new Date(cursor);

      nightStart.setHours(
        NIGHT_START_HOUR,
        0,
        0,
        0
      );

      // Kết thúc đêm: 06:00 hôm sau
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

      // Xác định xe có ở trong bãi
      // trong khoảng thời gian qua đêm không.
      const overlapStart = Math.max(
        checkInMs,
        nightStart.getTime()
      );

      const overlapEnd = Math.min(
        endMs,
        nightEnd.getTime()
      );

      const stayedOvernight =
        overlapEnd > overlapStart;

      if (stayedOvernight) {

        const nightDate = this.toLocalDate(
          nightStart
        );

        // Có yêu cầu đã duyệt đúng biển số,
        // tầng, vị trí và ngày hay không?
        const approved = overnightRequests.some(
          request =>
            this.normalizePlate(request.plate) ===
              this.normalizePlate(session.plate) &&

            request.floor === session.floor &&

            request.spot === session.spot &&

            request.nightDate === nightDate &&

            request.status === 'approved'
        );

        if (!approved) {
          violations++;
        }
      }

      // Sang ngày tiếp theo
      cursor.setDate(
        cursor.getDate() + 1
      );
    }

    return violations;
  }


  // =====================================
  // CHUẨN HÓA BIỂN SỐ
  // =====================================

  private normalizePlate(value: string): string {

    return value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
  }


  // =====================================
  // ĐỊNH DẠNG NGÀY YYYY-MM-DD
  // =====================================

  private toLocalDate(date: Date): string {

    const year = date.getFullYear();

    const month = String(
      date.getMonth() + 1
    ).padStart(2, '0');

    const day = String(
      date.getDate()
    ).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

}