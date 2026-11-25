
import {
  Component,
  inject,
  signal,
  OnInit,
  OnDestroy
} from '@angular/core';

import { RouterLink } from '@angular/router';

import {
  EMPTY,
  Subscription,
  catchError,
  exhaustMap,
  timer
} from 'rxjs';

import {
  BarrierService,
  type GateId,
  type GateState
} from '../../services/barrier.service';

import {
  PaymentApiService,
  type PaymentResponse
} from '../../services/payment-api.service';

import {
  ParkingAvailabilityPreview
} from '../../components/parking-availability-preview/parking-availability-preview';

// =====================================
// LƯU TRỮ TRẠNG THÁI XỬ LÝ THANH TOÁN
// =====================================

const PROCESSED_KEY =
  'smart-parking-exit-processed-payments-v1';

const PENDING_KEY =
  'smart-parking-exit-pending-payments-v1';

const BASELINE_KEY =
  'smart-parking-exit-baseline-initialized-v1';

// =====================================
// OPERATOR BARRIER COMPONENT
// =====================================

@Component({
  selector: 'app-operator-barrier',
  standalone: true,
  imports: [
    RouterLink,
    ParkingAvailabilityPreview
  ],
  templateUrl: './operator-barrier.html',
  styleUrl: './operator-barrier.scss'
})
export class OperatorBarrier implements OnInit, OnDestroy {

  // =====================================
  // 1. KẾT NỐI SERVICE
  // =====================================

  readonly barrier = inject(BarrierService);

  private readonly paymentApi = inject(
    PaymentApiService
  );

  // =====================================
  // 2. QUẢN LÝ POLLING
  // =====================================

  private pollingSubscription?: Subscription;

  private readonly POLLING_INTERVAL_MS = 2000;

  // =====================================
  // 3. QUẢN LÝ HÀNG ĐỢI THANH TOÁN
  // =====================================

  private processedPaymentCodes = new Set<string>();

  private pendingPaymentCodes: string[] = [];

  private activeExitPaymentCode: string | null = null;

  private baselineInitialized = false;

  // =====================================
  // 4. DANH SÁCH BARRIER
  // =====================================

  readonly gates: {
    id: GateId;
    name: string;
    subtitle: string;
  }[] = [
    {
      id: 'entry',
      name: 'Cổng vào',
      subtitle: 'Barrier dành cho xe đi vào'
    },
    {
      id: 'exit',
      name: 'Cổng ra',
      subtitle: 'Barrier dành cho xe đi ra'
    }
  ];

  // =====================================
  // 5. THÔNG BÁO
  // =====================================

  readonly message = signal('');

  // =====================================
  // 6. KHỞI TẠO
  // =====================================

  ngOnInit(): void {

    // Khôi phục hàng đợi từ lần sử dụng trước

    this.loadQueueState();

    console.log(
      '[OPERATOR] Bắt đầu theo dõi thanh toán.'
    );

    // Tự động kiểm tra Backend mỗi 2 giây

    this.pollingSubscription = timer(
      0,
      this.POLLING_INTERVAL_MS
    ).pipe(

      exhaustMap(() =>

        this.paymentApi.refreshPayments().pipe(

          catchError(error => {

            console.error(
              '[OPERATOR] Không thể lấy lịch sử thanh toán:',
              error
            );

            return EMPTY;

          })

        )

      )

    ).subscribe({

      next: payments => {

        this.handlePaymentUpdates(payments);

      }

    });

  }

  // =====================================
  // 7. NHẬN VÀ XỬ LÝ DANH SÁCH THANH TOÁN
  // =====================================

  private handlePaymentUpdates(
    payments: PaymentResponse[]
  ): void {

    // Lần đầu khởi tạo:
    // Đánh dấu các hóa đơn SUCCESS đã tồn tại
    // là lịch sử cũ, không tự động mở barrier.

    if (!this.baselineInitialized) {

      payments.forEach(payment => {

        if (payment.status === 'SUCCESS') {

          this.processedPaymentCodes.add(
            payment.paymentCode
          );

        }

      });

      this.pendingPaymentCodes =
        this.pendingPaymentCodes.filter(
          code => !this.processedPaymentCodes.has(code)
        );

      this.baselineInitialized = true;

      this.saveQueueState();

      console.log(
        '[OPERATOR] Đã khởi tạo dữ liệu thanh toán ban đầu.'
      );

      this.message.set(
        'Hệ thống đã bắt đầu theo dõi thanh toán từ Backend.'
      );

      return;

    }

    let queueChanged = false;

    // Tìm những hóa đơn SUCCESS chưa được xử lý

    for (const payment of payments) {

      if (payment.status !== 'SUCCESS') {
        continue;
      }

      const paymentCode = payment.paymentCode;

      // Bỏ qua hóa đơn đã xử lý

      if (
        this.processedPaymentCodes.has(paymentCode)
      ) {
        continue;
      }

      // Bỏ qua hóa đơn đã nằm trong hàng đợi

      if (
        this.pendingPaymentCodes.includes(paymentCode)
      ) {
        continue;
      }

      // Đưa hóa đơn mới vào hàng đợi

      this.pendingPaymentCodes.push(paymentCode);

      queueChanged = true;

      console.log(
        '[OPERATOR] Phát hiện thanh toán mới:',
        paymentCode
      );

    }

    if (queueChanged) {

      this.saveQueueState();

    }

    // Kiểm tra hàng đợi Barrier OUT

    this.processNextExitPayment();

  }

  // =====================================
  // 8. XỬ LÝ HÀNG ĐỢI MỞ BARRIER OUT
  // =====================================

  private processNextExitPayment(): void {

    // Nếu đang xử lý một hóa đơn

    if (this.activeExitPaymentCode !== null) {

      // Barrier vẫn đang mở:
      // Tiếp tục chờ tự động đóng.

      if (this.barrier.getState('exit') === 'open') {
        return;
      }

      // Barrier đã đóng:
      // Hoàn tất hóa đơn vừa xử lý.

      const completedCode =
        this.activeExitPaymentCode;

      this.processedPaymentCodes.add(
        completedCode
      );

      this.pendingPaymentCodes =
        this.pendingPaymentCodes.filter(
          code => code !== completedCode
        );

      this.activeExitPaymentCode = null;

      this.saveQueueState();

      console.log(
        '[OPERATOR] Đã hoàn tất xử lý hóa đơn:',
        completedCode
      );

    }

    // Nếu barrier đang mở thủ công
    // thì chưa xử lý hóa đơn tiếp theo.

    if (this.barrier.getState('exit') === 'open') {
      return;
    }

    // Lấy hóa đơn tiếp theo

    const nextPaymentCode =
      this.pendingPaymentCodes[0];

    if (!nextPaymentCode) {
      return;
    }

    // Đánh dấu hóa đơn đang được xử lý

    this.activeExitPaymentCode = nextPaymentCode;

    console.log(
      '[OPERATOR] Kích hoạt Barrier OUT:',
      nextPaymentCode
    );

    // Mở Barrier OUT và tự động đóng sau 5 giây

    this.barrier.openExitAfterPayment();

    this.message.set(
      `Đã xác nhận thanh toán ${nextPaymentCode}. Barrier OUT đang mở và sẽ tự động đóng sau 5 giây.`
    );

  }

  // =====================================
  // 9. KHÔI PHỤC HÀNG ĐỢI
  // =====================================

  private loadQueueState(): void {

    try {

      if (typeof localStorage === 'undefined') {
        return;
      }

      const processedRaw =
        localStorage.getItem(PROCESSED_KEY);

      const pendingRaw =
        localStorage.getItem(PENDING_KEY);

      const baselineRaw =
        localStorage.getItem(BASELINE_KEY);

      if (processedRaw) {

        const parsed: unknown =
          JSON.parse(processedRaw);

        if (Array.isArray(parsed)) {

          this.processedPaymentCodes = new Set(
            parsed.filter(
              (item): item is string =>
                typeof item === 'string'
            )
          );

        }

      }

      if (pendingRaw) {

        const parsed: unknown =
          JSON.parse(pendingRaw);

        if (Array.isArray(parsed)) {

          this.pendingPaymentCodes =
            parsed.filter(
              (item): item is string =>
                typeof item === 'string' &&
                !this.processedPaymentCodes.has(item)
            );

        }

      }

      this.baselineInitialized =
        baselineRaw === 'true';

    } catch (error) {

      console.error(
        '[OPERATOR] Không thể khôi phục hàng đợi:',
        error
      );

    }

  }

  // =====================================
  // 10. LƯU HÀNG ĐỢI
  // =====================================

  private saveQueueState(): void {

    try {

      if (typeof localStorage === 'undefined') {
        return;
      }

      localStorage.setItem(
        PROCESSED_KEY,
        JSON.stringify(
          [...this.processedPaymentCodes]
        )
      );

      localStorage.setItem(
        PENDING_KEY,
        JSON.stringify(
          this.pendingPaymentCodes
        )
      );

      localStorage.setItem(
        BASELINE_KEY,
        String(this.baselineInitialized)
      );

    } catch (error) {

      console.error(
        '[OPERATOR] Không thể lưu hàng đợi:',
        error
      );

    }

  }

  // =====================================
  // 11. ĐIỀU KHIỂN BARRIER THỦ CÔNG
  // =====================================

  changeState(
    gate: GateId,
    state: GateState
  ): void {

    const changed = this.barrier.setState(
      gate,
      state
    );

    const name =
      gate === 'entry' ? 'cổng vào' : 'cổng ra';

    const action =
      state === 'open' ? 'mở' : 'đóng';

    this.message.set(

      changed

        ? `Đã ${action} barrier ${name} (thao tác thủ công).`

        : `Barrier ${name} đã ở trạng thái này.`

    );

  }

  // =====================================
  // 12. ĐỊNH DẠNG THỜI GIAN
  // =====================================

  formatTime(value: string): string {

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('vi-VN', {

      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false

    }).format(date);

  }

  // =====================================
  // 13. HỦY POLLING KHI RỜI TRANG
  // =====================================

  ngOnDestroy(): void {

    this.pollingSubscription?.unsubscribe();

  }

}
