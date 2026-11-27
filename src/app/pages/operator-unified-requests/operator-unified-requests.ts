import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import {
  BookingRequestService,
  type ParkingBookingRequest,
  type BookingStatus
} from '../../services/booking-request.service';

import {
  OvernightRequestService,
  type OvernightRequest,
  type OvernightStatus
} from '../../services/overnight-request.service';

import {
  overnightDatesInRange
} from '../../services/overnight-window.util';

import { AppIcon } from '../../components/app-icon/app-icon';

import {
  Component,
  computed,
  inject,
  signal,
  OnInit
} from '@angular/core';

interface BookingReviewRow {
  booking: ParkingBookingRequest;
  overnights: OvernightRequest[];
  missingDates: string[];
}

@Component({
  selector: 'app-operator-unified-requests',
  standalone: true,

  imports: [
    RouterLink,
    DatePipe,
    AppIcon
  ],

  templateUrl: './operator-unified-requests.html',
  styleUrl: './operator-unified-requests.scss'
})
export class OperatorUnifiedRequests implements OnInit {

  readonly bookings = inject(
    BookingRequestService
  );

  readonly overnight = inject(
    OvernightRequestService
  );

  readonly message = signal('');
  readonly success = signal(false);

  // =====================================
  // GỘP BOOKING VÀ YÊU CẦU QUA ĐÊM
  // =====================================

  private readonly groupedData = computed(() => {

    const bookings = this.bookings.requests();
    const nights = this.overnight.requests();

    const rows: BookingReviewRow[] =
      bookings.map(booking => ({
        booking,
        overnights: [],
        missingDates: []
      }));

    const standalone: OvernightRequest[] = [];

    for (const night of nights) {
      // Yêu cầu qua đêm phát sinh trong lúc gửi xe.
// Hiển thị tại nhóm yêu cầu độc lập.

if (
  night.origin === 'manual' &&
  night.sessionId
) {

  standalone.push(night);

  continue;

}

      // Yêu cầu được tạo từ booking.
      if (night.bookingId) {

        const row = rows.find(
          item =>
            item.booking.id === night.bookingId
        );

        if (row) {
          row.overnights.push(night);
        } else {
          standalone.push(night);
        }

        continue;
      }

      // Yêu cầu qua đêm độc lập cũ.
      // Chỉ ghép nếu xác định được duy nhất
      // một booking phù hợp.

      const candidates = rows.filter(item => {

        const booking = item.booking;

        return (
          booking.userId !== null &&
          booking.userId === night.userId &&

          booking.plate.toUpperCase() ===
            night.plate.toUpperCase() &&

          booking.floor === night.floor &&
          booking.spot === night.spot &&

          (
            booking.status === 'pending' ||
            booking.status === 'approved'
          ) &&

          overnightDatesInRange(
            booking.startAt,
            booking.endAt
          ).includes(night.nightDate)
        );

      });

      if (candidates.length === 1) {
        candidates[0].overnights.push(night);
      } else {
        standalone.push(night);
      }

    }

    // Sắp xếp các đêm và kiểm tra
    // booking cũ chưa có yêu cầu qua đêm.

    for (const row of rows) {

      row.overnights.sort(
        (a, b) =>
          a.nightDate.localeCompare(b.nightDate)
      );

      const expectedDates = overnightDatesInRange(
        row.booking.startAt,
        row.booking.endAt
      );

      row.missingDates = expectedDates.filter(
        date =>
          !row.overnights.some(
            night => night.nightDate === date
          )
      );

    }

    return {
      rows,
      standalone
    };

  });

  readonly rows = computed(() =>
    this.groupedData().rows
  );

  readonly standaloneRequests = computed(() =>
    this.groupedData().standalone
  );

  // =====================================
  // THỐNG KÊ BOOKING TOÀN HỆ THỐNG
  // =====================================

  readonly pendingCount = computed(() =>
    this.bookings.pendingCount()
  );

  readonly approvedCount = computed(() =>
    this.bookings.approvedCount()
  );

  readonly rejectedCount = computed(() =>
    this.bookings.rejectedCount()
  );

  // Số yêu cầu qua đêm đang chờ.
  readonly overnightPendingCount = computed(() =>
    this.overnight.pendingCount()
  );

  ngOnInit(): void {

  void this.bookings.refreshAll().then(result => {

    if (!result.ok) {
      this.showResult(result);
    }

  });

}

  // =====================================
  // DUYỆT RIÊNG BOOKING
  // =====================================

async approveBooking(id: string): Promise<void> {

  const result =
    await this.bookings.approveRequest(id);

  this.showResult(result);

}

  // =====================================
  // TỪ CHỐI BOOKING
  // =====================================

async rejectBooking(id: string): Promise<void> {

  const result =
    await this.bookings.rejectRequest(id);

  this.showResult(result);

}

  // =====================================
  // KIỂM TRA QUYỀN DUYỆT QUA ĐÊM
  // =====================================

  canApproveNight(
    request: OvernightRequest
  ): boolean {

    if (request.status !== 'pending') {
      return false;
    }

    // Yêu cầu độc lập có thể duyệt riêng.
    if (
      !request.bookingId &&
      request.origin !== 'booking'
    ) {
      return true;
    }

    const booking = this.bookings.requests().find(
      item =>
        item.id === request.bookingId
    );

    // Không duyệt yêu cầu tự sinh nếu booking
    // không còn tồn tại hoặc đã bị hủy/từ chối.

    return !!booking && (
      booking.status === 'pending' ||
      booking.status === 'approved'
    );

  }

  // =====================================
  // DUYỆT RIÊNG QUA ĐÊM
  // =====================================

  approveOvernight(
    request: OvernightRequest
  ): void {

    if (!this.canApproveNight(request)) {

      this.showResult({
        ok: false,
        message: 'Không thể duyệt yêu cầu qua đêm này.'
      });

      return;
    }

    const result =
      this.overnight.approveRequest(request.id);

    this.showResult(result);

  }

  // =====================================
  // TỪ CHỐI RIÊNG QUA ĐÊM
  // =====================================

  rejectOvernight(id: string): void {

    const result =
      this.overnight.rejectRequest(id);

    this.showResult(result);

  }

  // =====================================
  // SỐ ĐÊM ĐANG CHỜ DUYỆT
  // =====================================

  pendingNightCount(
    row: BookingReviewRow
  ): number {

    return row.overnights.filter(
      item => this.canApproveNight(item)
    ).length;

  }

  // =====================================
  // DUYỆT BOOKING + QUA ĐÊM
  // BẰNG MỘT LẦN NHẤN NÚT
  // =====================================

async approveAll(bookingId: string): Promise<void> {

    const row = this.rows().find(
      item => item.booking.id === bookingId
    );

    if (!row) {

      this.showResult({
        ok: false,
        message: 'Không tìm thấy yêu cầu.'
      });

      return;
    }

    if (
      row.booking.status !== 'pending' &&
      row.booking.status !== 'approved'
    ) {

      this.showResult({
        ok: false,
        message: 'Booking không còn hợp lệ.'
      });

      return;
    }

    const pendingNights = row.overnights.filter(
      item => this.canApproveNight(item)
    );

    // Duyệt đặt chỗ trước.
    // Nếu giữ chỗ thất bại, dừng lại,
    // không duyệt thêm yêu cầu qua đêm.

if (row.booking.status === 'pending') {

  const bookingResult =
    await this.bookings.approveRequest(bookingId);

  if (!bookingResult.ok) {

    this.showResult(bookingResult);

    return;

  }

}

    // Tiếp tục duyệt từng đêm.

    let approvedNights = 0;

    const errors: string[] = [];

    for (const night of pendingNights) {

      const result =
        this.overnight.approveRequest(night.id);

      if (result.ok) {

        approvedNights++;

      } else {

        errors.push(
          `${night.nightDate}: ${result.message}`
        );

      }

    }

    // Báo đúng kết quả thực tế,
    // không báo thành công toàn bộ nếu có lỗi.

    if (errors.length > 0) {

      this.showResult({
        ok: false,

        message:
          `Booking đã được duyệt. ` +
          `Đã duyệt ${approvedNights}/` +
          `${pendingNights.length} đêm. ` +
          `Lỗi: ${errors.join('; ')}`
      });

      return;
    }

    this.showResult({
      ok: true,

      message:
        `Đặt chỗ đã được duyệt. ` +
        `Đã duyệt thêm ${approvedNights} ` +
        `yêu cầu qua đêm đang chờ.`
    });

  }

  // =====================================
  // HIỂN THỊ TRẠNG THÁI
  // =====================================

  statusLabel(
    status: BookingStatus | OvernightStatus
  ): string {

    switch (status) {

      case 'pending':
        return 'Chờ duyệt';

      case 'approved':
        return 'Đã duyệt';

      case 'rejected':
        return 'Từ chối';

      case 'cancelled':
        return 'Đã hủy';
      
      case 'checked_in':
  return 'Đã Check-in';

case 'completed':
  return 'Đã hoàn tất';

    }

  }

  ownerLabel(
    userId: string | null
  ): string {

    return userId
      ? `User ${userId}`
      : 'Chưa xác định tài khoản';

  }

  private showResult(result: {
    ok: boolean;
    message: string;
  }): void {

    this.success.set(result.ok);

    this.message.set(result.message);

  }

}
