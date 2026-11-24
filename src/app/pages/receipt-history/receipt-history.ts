
import {
  Component,
  computed,
  inject,
  signal,
  OnInit,
  OnDestroy
} from '@angular/core';

import {
  EMPTY,
  Subscription,
  catchError,
  exhaustMap,
  interval
} from 'rxjs';

import {
  Router,
  RouterLink
} from '@angular/router';

import {
  PaymentApiService,
  type PaymentResponse,
  type PaymentStatus
} from '../../services/payment-api.service';

import {
  DemoUserService
} from '../../services/demo-user.service';

import {
  BarrierService
} from '../../services/barrier.service';

@Component({
  selector: 'app-receipt-history',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './receipt-history.html',
  styleUrl: './receipt-history.scss'
})
export class ReceiptHistory implements OnInit, OnDestroy {

  private pollingSubscription?: Subscription;

  

  private readonly router = inject(Router);

  private readonly api = inject(PaymentApiService);
  private readonly barrier = inject(
  BarrierService
);

  readonly demoUser = inject(DemoUserService);

  // =====================================
  // PHÂN BIỆT VAI TRÒ
  // =====================================

  readonly isOperator =
    this.router.url.startsWith('/operator');

  readonly backRoute =
    this.isOperator ? '/operator' : '/customer';

  // Biển số tự động theo tài khoản
  readonly customerPlate = computed(
    () => this.demoUser.activePlate()
  );

  // =====================================
  // DỮ LIỆU THANH TOÁN
  // =====================================

  readonly payments = signal<PaymentResponse[]>([]);

  readonly loading = signal(false);

  readonly feedback = signal('');

  readonly feedbackError = signal(false);

  readonly confirmingPayment = signal<string | null>(null);

  readonly search = signal('');

  // =====================================
  // DANH SÁCH HÓA ĐƠN
  // =====================================

  readonly visiblePayments = computed(() => {

    const allPayments = this.payments();

    const plate = this.normalize(
      this.customerPlate()
    );

    const keyword = this.normalize(
      this.search()
    );

    return allPayments

      .filter(payment => {

        // Người điều hành xem toàn bộ giao dịch
        if (this.isOperator) {

          if (!keyword) {
            return true;
          }

          return (
            this.normalize(payment.licensePlate)
              .includes(keyword) ||

            payment.paymentCode
              .toUpperCase()
              .includes(keyword) ||

            payment.sessionCode
              .toUpperCase()
              .includes(keyword)
          );
        }

        // Người dùng chỉ xem hóa đơn
        // thuộc biển số tài khoản hiện tại
        return (
          plate.length > 0 &&
          this.normalize(payment.licensePlate) === plate
        );

      })

      .sort((a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime()
      );
  });

  // =====================================
  // THỐNG KÊ
  // =====================================

  readonly totalCount = computed(
    () => this.visiblePayments().length
  );

  readonly unpaidCount = computed(() =>
    this.visiblePayments().filter(
      payment => payment.status === 'PENDING'
    ).length
  );

  readonly totalAmount = computed(() =>
    this.visiblePayments().reduce(
      (total, payment) => total + payment.amount,
      0
    )
  );

  readonly unpaidAmount = computed(() =>
    this.visiblePayments()
      .filter(payment => payment.status === 'PENDING')
      .reduce(
        (total, payment) => total + payment.amount,
        0
      )
  );

  // =====================================
  // KHỞI TẠO
  // =====================================

// =====================================
// KHỞI TẠO VÀ TỰ ĐỘNG CẬP NHẬT
// =====================================

ngOnInit(): void {

  // Tải hóa đơn ngay khi mở trang
  this.loadPayments();

  // Chỉ tự động Polling ở Customer App
  if (!this.isOperator) {

    this.pollingSubscription = interval(5000)

      .pipe(

        exhaustMap(() =>
          this.api.refreshPayments().pipe(

            catchError(error => {

              console.error(
                'Lỗi tự động cập nhật hóa đơn:',
                error
              );

              return EMPTY;

            })

          )
        )

      )

      .subscribe((response: PaymentResponse[]) => {

        this.payments.set(response);

      });

  }

}


// =====================================
// HỦY POLLING KHI RỜI TRANG
// =====================================

ngOnDestroy(): void {

  this.pollingSubscription?.unsubscribe();

}

  // =====================================
  // TẢI HÓA ĐƠN TỪ BACKEND
  // =====================================

  loadPayments(): void {

    this.loading.set(true);

    this.feedback.set('');

    this.api.refreshPayments().subscribe({

      next: (response: PaymentResponse[]) => {

        this.payments.set(response);

        this.loading.set(false);

        this.feedbackError.set(false);

      },

      error: (error: unknown) => {

        console.error(
          'Lỗi tải hóa đơn:',
          error
        );

        this.loading.set(false);

        this.feedback.set(
          'Không thể tải hóa đơn. Vui lòng kiểm tra Backend.'
        );

        this.feedbackError.set(true);

      }

    });

  }

  // =====================================
  // THANH TOÁN HÓA ĐƠN
  // =====================================


confirmPayment(payment: PaymentResponse): void {

  if (this.confirmingPayment()) {
    return;
  }

  if (payment.status !== 'PENDING') {
    return;
  }

  this.confirmingPayment.set(payment.paymentCode);

  this.feedback.set('');

  this.feedbackError.set(false);

  this.api.confirmPayment(
    payment.paymentCode
  ).subscribe({

    next: (updatedPayment) => {

      this.confirmingPayment.set(null);

      // 1. Cập nhật dữ liệu thanh toán
      this.payments.update(current =>
        current.map(item =>
          item.paymentCode === updatedPayment.paymentCode
            ? updatedPayment
            : item
        )
      );

      // 2. Chỉ mở barrier nếu Backend xác nhận SUCCESS
      if (updatedPayment.status !== 'SUCCESS') {

        this.feedback.set(
          'Backend chưa xác nhận thanh toán thành công. Barrier OUT vẫn đóng.'
        );

        this.feedbackError.set(true);

        return;
      }

      // 3. YÊU CẦU MỞ BARRIER OUT
      this.barrier.setState(
        'exit',
        'open'
      );

      // 4. Thông báo kết quả
      this.feedback.set(
        `Thanh toán thành công cho xe ${updatedPayment.licensePlate}. Barrier OUT đã được yêu cầu mở (mô phỏng).`
      );

      this.feedbackError.set(false);

    },

    error: (error: unknown) => {

      console.error(
        'Lỗi thanh toán:',
        error
      );

      this.confirmingPayment.set(null);

      this.feedback.set(
        'Thanh toán thất bại. Barrier OUT sẽ không được mở.'
      );

      this.feedbackError.set(true);

    }

  });

}


  // =====================================
  // TRẠNG THÁI HÓA ĐƠN
  // =====================================

  paymentStatusText(status: PaymentStatus): string {

    switch (status) {

      case 'PENDING':
        return '◷ Chờ thanh toán';

      case 'SUCCESS':
        return '✓ Đã thanh toán';

      case 'FAILED':
        return '✕ Thất bại';

      case 'CANCELLED':
        return '✕ Đã hủy';

    }

  }

  // =====================================
  // PHƯƠNG THỨC THANH TOÁN
  // =====================================

  paymentMethodText(method: string): string {

    switch (method) {

      case 'SIMULATED':
        return '';

      default:
        return method || 'Chưa thanh toán';

    }

  }

  // =====================================
  // ĐỊNH DẠNG TIỀN
  // =====================================

  money(amount: number): string {

    return new Intl.NumberFormat('vi-VN')
      .format(amount) + 'đ';

  }

  // =====================================
  // ĐỊNH DẠNG NGÀY GIỜ
  // =====================================

  formatDate(value: string | null): string {

    if (!value) {
      return '—';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '—';
    }

    return date.toLocaleString('vi-VN', {

      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false

    });

  }

  // =====================================
  // CHUẨN HÓA BIỂN SỐ
  // =====================================

  private normalize(value: string): string {

    return value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');

  }

}
