
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

import { AppIcon } from '../../components/app-icon/app-icon';

// =====================================
// RECEIPT HISTORY COMPONENT
// =====================================

@Component({
  selector: 'app-receipt-history',
  standalone: true,
  imports: [RouterLink, AppIcon],
  templateUrl: './receipt-history.html',
  styleUrl: './receipt-history.scss'
})
export class ReceiptHistory implements OnInit, OnDestroy {

  // =====================================
  // 1. QUẢN LÝ POLLING
  // =====================================

  private pollingSubscription?: Subscription;

  private readonly POLLING_INTERVAL_MS = 5000;

  // =====================================
  // 2. KẾT NỐI SERVICE
  // =====================================

  private readonly router = inject(Router);

  private readonly api = inject(
    PaymentApiService
  );

  readonly demoUser = inject(DemoUserService);

  // =====================================
  // 3. PHÂN BIỆT VAI TRÒ
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
  // 4. DỮ LIỆU THANH TOÁN
  // =====================================

  readonly payments = signal<PaymentResponse[]>([]);

  readonly loading = signal(false);

  readonly feedback = signal('');

  readonly feedbackError = signal(false);

  readonly confirmingPayment = signal<string | null>(null);

  readonly search = signal('');

  // =====================================
  // 5. DANH SÁCH HÓA ĐƠN HIỂN THỊ
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

        // Operator xem toàn bộ giao dịch

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

        // Customer chỉ xem hóa đơn
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
  // 6. THỐNG KÊ HÓA ĐƠN
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
  // 7. KHỞI TẠO COMPONENT
  // =====================================

  ngOnInit(): void {

    // Tải hóa đơn ngay khi mở trang

    this.loadPayments();

    // Customer tự động cập nhật hóa đơn
    // Operator có cơ chế polling riêng
    // trong operator-barrier.ts

    if (!this.isOperator) {

      this.pollingSubscription = interval(
        this.POLLING_INTERVAL_MS
      )

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
  // 8. HỦY POLLING KHI RỜI TRANG
  // =====================================

  ngOnDestroy(): void {

    this.pollingSubscription?.unsubscribe();

  }

  // =====================================
  // 9. TẢI HÓA ĐƠN TỪ BACKEND
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
  // 10. XÁC NHẬN THANH TOÁN
  // =====================================

  confirmPayment(payment: PaymentResponse): void {

    // Không cho phép xác nhận nhiều hóa đơn cùng lúc

    if (this.confirmingPayment()) {
      return;
    }

    // Chỉ xác nhận hóa đơn đang PENDING

    if (payment.status !== 'PENDING') {
      return;
    }

    this.confirmingPayment.set(
      payment.paymentCode
    );

    this.feedback.set('');

    this.feedbackError.set(false);

    // Gửi yêu cầu xác nhận thanh toán lên Backend

    this.api.confirmPayment(
      payment.paymentCode
    ).subscribe({

      next: (updatedPayment: PaymentResponse) => {

        this.confirmingPayment.set(null);

        // =====================================
        // CẬP NHẬT HÓA ĐƠN
        // =====================================

        this.payments.update(current =>

          current.map(item =>

            item.paymentCode === updatedPayment.paymentCode

              ? updatedPayment

              : item

          )

        );

        // =====================================
        // KIỂM TRA KẾT QUẢ BACKEND
        // =====================================

        if (updatedPayment.status !== 'SUCCESS') {

          this.feedback.set(
            'Backend chưa xác nhận thanh toán thành công. Vui lòng kiểm tra lại.'
          );

          this.feedbackError.set(true);

          return;

        }

        // =====================================
        // THANH TOÁN THÀNH CÔNG
        // =====================================

        this.feedback.set(

          `Thanh toán thành công cho xe ${updatedPayment.licensePlate}. Hệ thống Operator sẽ tự động phát hiện giao dịch và xử lý Barrier OUT.`

        );

        this.feedbackError.set(false);

        console.log(
          '[PAYMENT] Thanh toán thành công:',
          updatedPayment
        );

        console.log(
          '[PAYMENT] Operator sẽ tự động kiểm tra giao dịch SUCCESS.'
        );

      },

      error: (error: unknown) => {

        console.error(
          'Lỗi thanh toán:',
          error
        );

        this.confirmingPayment.set(null);

        this.feedback.set(
          'Thanh toán thất bại. Vui lòng thử lại.'
        );

        this.feedbackError.set(true);

      }

    });

  }

  // =====================================
  // 11. HIỂN THỊ TRẠNG THÁI HÓA ĐƠN
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
  // 12. PHƯƠNG THỨC THANH TOÁN
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
  // 13. ĐỊNH DẠNG TIỀN
  // =====================================

  money(amount: number): string {

    return new Intl.NumberFormat('vi-VN')
      .format(amount) + 'đ';

  }

  // =====================================
  // 14. ĐỊNH DẠNG NGÀY GIỜ
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
  // 15. CHUẨN HÓA BIỂN SỐ
  // =====================================

  private normalize(value: string): string {

    return value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');

  }

}
