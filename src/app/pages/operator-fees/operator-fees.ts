
import {
  Component,
  computed,
  inject,
  signal,
  OnInit
} from '@angular/core';

import {
  RouterLink
} from '@angular/router';

import {
  PaymentApiService,
  type PaymentResponse,
  type PaymentStatus
} from '../../services/payment-api.service';

import {
  BarrierService
} from '../../services/barrier.service';
// =====================================
// BỘ LỌC THANH TOÁN
// =====================================

type PaymentFilter =
  | 'all'
  | 'pending'
  | 'success'
  | 'failed'
  | 'cancelled';

// =====================================
// OPERATOR FEES COMPONENT
// =====================================

@Component({
  selector: 'app-operator-fees',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './operator-fees.html',
  styleUrl: './operator-fees.scss'
})
export class OperatorFees implements OnInit {



confirmPayment(paymentCode: string): void {

  if (this.confirmingPayment()) {
    return;
  }

  this.confirmingPayment.set(paymentCode);
  this.feedback.set('');
  this.feedbackError.set(false);

  this.api.confirmPayment(paymentCode).subscribe({

    next: (updatedPayment) => {

      this.confirmingPayment.set(null);

      // Chỉ thực hiện tiếp nếu Backend
      // đã xác nhận thanh toán thành công.
      if (updatedPayment.status !== 'SUCCESS') {

        this.feedback.set(
          'Backend chưa xác nhận thanh toán thành công.'
        );

        this.feedbackError.set(true);
        return;
      }

      // 1. Cập nhật danh sách Payment
      this.payments.update(current =>
        current.map(payment =>
          payment.paymentCode === updatedPayment.paymentCode
            ? updatedPayment
            : payment
        )
      );

      // 2. Mở Barrier OUT mô phỏng
      this.barrier.setState(
        'exit',
        'open'
      );

      // 3. Hiển thị thông báo
      this.feedback.set(
        'Thanh toán thành công! ' +
        'Mã giao dịch: ' +
        updatedPayment.paymentCode +
        '. Barrier OUT đã được yêu cầu mở (mô phỏng).'
      );

      this.feedbackError.set(false);

    },

    error: (error: unknown) => {

      console.error(
        'Lỗi xác nhận thanh toán:',
        error
      );

      this.confirmingPayment.set(null);

      this.feedback.set(
        'Không thể xác nhận thanh toán. ' +
        'Barrier OUT sẽ không được mở.'
      );

      this.feedbackError.set(true);

    }

  });

}


private readonly barrier = inject(
  BarrierService
);
  // =====================================
  // KẾT NỐI PAYMENT API
  // =====================================

  private readonly api = inject(
    PaymentApiService
  );

  // =====================================
  // DỮ LIỆU THANH TOÁN TỪ BACKEND
  // =====================================

  readonly payments = signal<PaymentResponse[]>([]);

  readonly loading = signal(false);

  readonly feedback = signal('');

  readonly feedbackError = signal(false);

  // =====================================
  // TÌM KIẾM VÀ BỘ LỌC
  // =====================================

  readonly search = signal('');

  readonly filter = signal<PaymentFilter>('all');


readonly confirmingPayment = signal<string | null>(null);


  // =====================================
  // THỐNG KÊ GIAO DỊCH
  // =====================================

  readonly totalCount = computed(() =>
    this.payments().length
  );

  readonly pendingCount = computed(() =>
    this.payments().filter(
      payment => payment.status === 'PENDING'
    ).length
  );

  readonly successCount = computed(() =>
    this.payments().filter(
      payment => payment.status === 'SUCCESS'
    ).length
  );

  readonly failedCount = computed(() =>
    this.payments().filter(
      payment => payment.status === 'FAILED'
    ).length
  );

  readonly cancelledCount = computed(() =>
    this.payments().filter(
      payment => payment.status === 'CANCELLED'
    ).length
  );

  // Tổng tiền đã thanh toán thành công

  readonly totalPaid = computed(() =>
    this.payments()
      .filter(payment => payment.status === 'SUCCESS')
      .reduce(
        (total, payment) => total + payment.amount,
        0
      )
  );

  // Tổng tiền đang chờ thanh toán

  readonly totalPending = computed(() =>
    this.payments()
      .filter(payment => payment.status === 'PENDING')
      .reduce(
        (total, payment) => total + payment.amount,
        0
      )
  );

  // =====================================
  // DANH SÁCH GIAO DỊCH ĐÃ LỌC
  // =====================================

  readonly filteredPayments = computed(() => {

    const keyword = this.search()
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');

    const selectedFilter = this.filter();

    return this.payments()
      .filter(payment => {

        // Lọc trạng thái

        if (
          selectedFilter !== 'all' &&
          payment.status !== selectedFilter.toUpperCase()
        ) {
          return false;
        }

        // Tìm kiếm biển số, mã giao dịch, mã phiên

        const plate = payment.licensePlate
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '');

        const paymentCode = payment.paymentCode
          .toUpperCase();

        const sessionCode = payment.sessionCode
          .toUpperCase();

        const matchesSearch =
          keyword === '' ||
          plate.includes(keyword) ||
          paymentCode.includes(keyword) ||
          sessionCode.includes(keyword);

        return matchesSearch;

      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      );

  });

  // =====================================
  // TỰ ĐỘNG TẢI DỮ LIỆU
  // =====================================

  ngOnInit(): void {

    this.loadPayments();

  }

  // =====================================
  // LẤY LỊCH SỬ THANH TOÁN TỪ BACKEND
  // =====================================

  loadPayments(): void {

    this.loading.set(true);

    this.feedback.set('');

this.api.refreshPayments().subscribe({

  next: (response: PaymentResponse[]) => {

        this.payments.set(response);

        this.loading.set(false);

        this.feedback.set(
          ``
        );

        this.feedbackError.set(false);

      },

      error: (error: unknown) => {

        console.error(
          'Lỗi tải lịch sử thanh toán:',
          error
        );

        this.loading.set(false);

        this.feedback.set(
          'Không thể tải lịch sử thanh toán. ' +
          'Hãy kiểm tra Backend và API.'
        );

        this.feedbackError.set(true);

      }

    });

  }

  // =====================================
  // HIỂN THỊ TRẠNG THÁI
  // =====================================

  paymentStatusText(
    status: PaymentStatus
  ): string {

    switch (status) {

      case 'PENDING':
        return '◷ Chờ thanh toán';

      case 'SUCCESS':
        return '✓ Thành công';

      case 'FAILED':
        return '✕ Thất bại';

      case 'CANCELLED':
        return '✕ Đã hủy';

    }

  }

  // =====================================
  // HIỂN THỊ PHƯƠNG THỨC THANH TOÁN
  // =====================================

  paymentMethodText(
    method: string
  ): string {

    switch (method) {

      case 'SIMULATED':
        return 'Thanh toán mô phỏng';

      default:
        return method;

    }

  }

  // =====================================
  // ĐỊNH DẠNG TIỀN
  // =====================================

  formatMoney(value: number): string {

    return (
      new Intl.NumberFormat('vi-VN').format(value) +
      'đ'
    );

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
