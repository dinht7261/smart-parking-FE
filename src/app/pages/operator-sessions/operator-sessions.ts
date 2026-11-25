
import {
  Component,
  inject,
  signal,
  computed,
  OnInit
} from '@angular/core';

import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';

import {
  ParkingSessionApiService,
  type ParkingSessionApiResponse
} from '../../services/parking-session-api.service';

// =====================================
// BỘ LỌC PHIÊN GỬI XE
// =====================================

type SessionFilter =
  | 'all'
  | 'active'
  | 'awaiting-payment'
  | 'completed';

// =====================================
// KIỂU DỮ LIỆU HIỂN THỊ
// =====================================

interface OperatorSession {

  id: string;

  sessionCode: string;

  sessionType: 'WALK_IN' | 'RESERVATION';

  plate: string;

  floor: string;

  spot: string;

  checkInAt: string;

  checkOutAt: string | null;

  status:
    | 'ACTIVE'
    | 'AWAITING_PAYMENT'
    | 'COMPLETED'
    | 'CANCELLED';
}

// =====================================
// OPERATOR SESSIONS COMPONENT
// CHỈ THEO DÕI PARKING SESSION
// =====================================

@Component({
  selector: 'app-operator-sessions',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './operator-sessions.html',
  styleUrl: './operator-sessions.scss'
})
export class OperatorSessions implements OnInit {

  // =====================================
  // KẾT NỐI API
  // =====================================

  private readonly api = inject(
    ParkingSessionApiService
  );

  // =====================================
  // DỮ LIỆU SESSION
  // =====================================

  readonly sessions = signal<OperatorSession[]>([]);

  readonly loading = signal(false);

  readonly feedback = signal('');

  readonly feedbackError = signal(false);

  readonly checkingOut = signal<string | null>(null);

  // =====================================
  // TÌM KIẾM VÀ BỘ LỌC
  // =====================================

  readonly filter = signal<SessionFilter>('all');

  readonly search = signal('');

  // =====================================
  // THỐNG KÊ SESSION
  // =====================================

  readonly activeCount = computed(() =>

    this.sessions().filter(
      session => session.status === 'ACTIVE'
    ).length

  );

  readonly awaitingPaymentCount = computed(() =>

    this.sessions().filter(
      session => session.status === 'AWAITING_PAYMENT'
    ).length

  );

  readonly completedCount = computed(() =>

    this.sessions().filter(
      session =>
        session.status === 'COMPLETED' ||
        session.status === 'CANCELLED'
    ).length

  );

  // =====================================
  // LỌC DANH SÁCH SESSION
  // =====================================

  readonly filteredSessions = computed(() => {

    const selectedFilter = this.filter();

    const keyword = this.search()
      .trim()
      .toUpperCase();

    return this.sessions().filter(session => {

      // Lọc trạng thái

      if (
        selectedFilter === 'active' &&
        session.status !== 'ACTIVE'
      ) {
        return false;
      }

      if (
        selectedFilter === 'awaiting-payment' &&
        session.status !== 'AWAITING_PAYMENT'
      ) {
        return false;
      }

      if (
        selectedFilter === 'completed' &&
        session.status !== 'COMPLETED' &&
        session.status !== 'CANCELLED'
      ) {
        return false;
      }

      // Tìm kiếm biển số và mã phiên

      if (
        keyword &&
        !session.plate.toUpperCase().includes(keyword) &&
        !session.sessionCode.toUpperCase().includes(keyword)
      ) {
        return false;
      }

      return true;

    });

  });

  // =====================================
  // TỰ ĐỘNG TẢI KHI MỞ TRANG
  // =====================================

  ngOnInit(): void {

    this.loadSessions();

  }

  // =====================================
  // TẢI SESSION TỪ BACKEND
  // =====================================

  loadSessions(): void {

    if (this.loading()) {
      return;
    }

    this.loading.set(true);

    this.feedback.set('');

    this.api.getSessionHistory().subscribe({

      next: (response: ParkingSessionApiResponse[]) => {

        const mappedSessions = response.map(
          item => this.mapSession(item)
        );

        this.sessions.set(mappedSessions);

        this.loading.set(false);

        this.feedback.set(
          `Đã đồng bộ ${mappedSessions.length} phiên gửi xe từ Backend.`
        );

        this.feedbackError.set(false);

      },

      error: (error: unknown) => {

        console.error(
          'Lỗi tải lịch sử gửi xe:',
          error
        );

        this.loading.set(false);

        this.feedback.set(
          'Không thể kết nối Backend. ' +
          'Hãy kiểm tra Spring Boot và API.'
        );

        this.feedbackError.set(true);

      }

    });

  }

  // =====================================
  // CHECK-OUT VÀ TẠO HÓA ĐƠN
  // Backend tự tạo hóa đơn sau khi Check-out thành công.
  // =====================================

  checkOut(session: OperatorSession): void {

    if (
      session.status !== 'ACTIVE' ||
      this.checkingOut() !== null
    ) {
      return;
    }

    this.checkingOut.set(session.sessionCode);
    this.feedback.set('');
    this.feedbackError.set(false);

    this.api.checkOut(session.sessionCode).subscribe({

      next: response => {

        const updatedSession = this.mapSession(response);

        this.sessions.update(current =>
          current.map(item =>
            item.sessionCode === updatedSession.sessionCode
              ? updatedSession
              : item
          )
        );

        this.checkingOut.set(null);

        this.feedback.set(
          `Check-out thành công cho xe ${updatedSession.plate}. ` +
          'Hóa đơn đã được tạo và đang chờ thanh toán.'
        );

        this.feedbackError.set(false);

      },

      error: (error: HttpErrorResponse) => {

        console.error(
          'Lỗi Check-out phiên gửi xe:',
          error
        );

        this.checkingOut.set(null);
        this.feedback.set(this.getErrorMessage(error));
        this.feedbackError.set(true);

      }

    });

  }

  // =====================================
  // LẤY THÔNG BÁO LỖI TỪ BACKEND
  // =====================================

  private getErrorMessage(error: HttpErrorResponse): string {

    const body = error.error;

    if (typeof body === 'string' && body.trim()) {
      return body;
    }

    if (body && typeof body === 'object') {

      const details = body as Record<string, unknown>;

      const message =
        details['detail'] ??
        details['message'] ??
        details['error'];

      if (typeof message === 'string' && message.trim()) {
        return message;
      }

    }

    if (error.status === 0) {
      return 'Không thể kết nối Backend. Hãy kiểm tra Spring Boot và thử lại.';
    }

    return `Check-out thất bại (HTTP ${error.status}).`;

  }

  // =====================================
  // MAP DỮ LIỆU BACKEND SANG FRONTEND
  // =====================================

  private mapSession(
    item: ParkingSessionApiResponse
  ): OperatorSession {

    return {

      id: String(item.id),

      sessionCode: item.sessionCode,

      sessionType: item.sessionType,

      plate: item.licensePlate,

      floor: item.floorCode,

      spot: item.spotCode,

      checkInAt: item.checkInTime,

      checkOutAt: item.checkOutTime,

      status: item.status

    };

  }

  // =====================================
  // HIỂN THỊ TRẠNG THÁI
  // =====================================

  sessionStatusText(
    status: OperatorSession['status']
  ): string {

    switch (status) {

      case 'ACTIVE':
        return '● Đang gửi';

      case 'AWAITING_PAYMENT':
        return '◷ Chờ thanh toán';

      case 'COMPLETED':
        return '✓ Hoàn tất';

      case 'CANCELLED':
        return '✕ Đã hủy';

    }

  }

  // =====================================
  // HIỂN THỊ LOẠI PHIÊN
  // =====================================

  sessionTypeText(
    type: OperatorSession['sessionType']
  ): string {

    return type === 'RESERVATION'
      ? 'Đặt chỗ trước'
      : 'Khách vãng lai';

  }

  // =====================================
  // ĐỊNH DẠNG THỜI GIAN
  // =====================================

  formatTime(value: string | null): string {

    if (!value) {

      return 'Chưa ghi nhận';

    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {

      return value;

    }

    return new Intl.DateTimeFormat('vi-VN', {

      day: '2-digit',

      month: '2-digit',

      year: 'numeric',

      hour: '2-digit',

      minute: '2-digit',

      hour12: false

    }).format(date);

  }

}
