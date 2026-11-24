
import {
  Injectable,
  inject,
  signal
} from '@angular/core';

import {
  Observable,
  switchMap,
  tap,
  throwError
} from 'rxjs';

import {
  ParkingSessionApiService
} from './parking-session-api.service';

import {
  PaymentApiService,
  type PaymentResponse
} from './payment-api.service';

import {
  BarrierService
} from './barrier.service';

// =====================================
// PARKING CHECKOUT SERVICE
// =====================================

@Injectable({
  providedIn: 'root'
})
export class ParkingCheckoutService {

  // =====================================
  // KẾT NỐI CÁC SERVICE
  // =====================================

  private readonly sessionApi = inject(
    ParkingSessionApiService
  );

  private readonly paymentApi = inject(
    PaymentApiService
  );

  private readonly barrier = inject(
    BarrierService
  );

  // =====================================
  // HÓA ĐƠN HIỆN TẠI
  // =====================================

  readonly currentPayment =
    signal<PaymentResponse | null>(null);

  // =====================================
  // 1. CHECK-OUT VÀ TẠO HÓA ĐƠN
  // =====================================

  checkout(
    sessionCode: string
  ): Observable<PaymentResponse> {

    if (!sessionCode || !sessionCode.trim()) {

      return throwError(
        () => new Error(
          'Mã phiên gửi xe không hợp lệ'
        )
      );

    }

    this.currentPayment.set(null);

    // Bước 1: Gửi yêu cầu Check-out lên Backend

    return this.sessionApi.checkOut(
      sessionCode.trim()
    ).pipe(

      // Bước 2: Khi Check-out thành công,
      // tạo hóa đơn từ Backend

      switchMap(session => {

        if (session.status !== 'AWAITING_PAYMENT') {

          return throwError(
            () => new Error(
              'Phiên gửi xe chưa sẵn sàng thanh toán'
            )
          );

        }

        return this.createInvoice(
          session.sessionCode
        );

      })

    );

  }

  // =====================================
  // 2. TẠO HÓA ĐƠN
  // Có thể gọi lại nếu tạo hóa đơn bị lỗi
  // =====================================

  createInvoice(
    sessionCode: string
  ): Observable<PaymentResponse> {

    return this.paymentApi.createPayment(
      sessionCode
    ).pipe(

      tap(payment => {

        this.currentPayment.set(payment);

      })

    );

  }

  // =====================================
  // 3. XÁC NHẬN THANH TOÁN MÔ PHỎNG
  // =====================================

  confirmPayment(
    paymentCode: string
  ): Observable<PaymentResponse> {

    const current = this.currentPayment();

    if (
      !current ||
      current.paymentCode !== paymentCode
    ) {

      return throwError(
        () => new Error(
          'Không tìm thấy hóa đơn thanh toán hiện tại'
        )
      );

    }

    if (current.status !== 'PENDING') {

      return throwError(
        () => new Error(
          'Hóa đơn không ở trạng thái chờ thanh toán'
        )
      );

    }

    // Gửi yêu cầu xác nhận lên Backend

    return this.paymentApi.confirmPayment(
      paymentCode
    ).pipe(

      tap(payment => {

        // Chỉ mở Barrier khi Backend xác nhận SUCCESS

        if (payment.status !== 'SUCCESS') {

          throw new Error(
            'Thanh toán chưa được xác nhận thành công'
          );

        }

        // Cập nhật hóa đơn hiện tại

        this.currentPayment.set(payment);

        // Mở Barrier OUT mô phỏng

        this.barrier.setState(
          'exit',
          'open'
        );

      })

    );

  }

  // =====================================
  // 4. ĐÓNG BARRIER OUT
  // =====================================

  closeExitBarrier(): void {

    this.barrier.setState(
      'exit',
      'closed'
    );

  }

  // =====================================
  // 5. XÓA HÓA ĐƠN ĐANG HIỂN THỊ
  // =====================================

  clearCurrentPayment(): void {

    this.currentPayment.set(null);

  }

}
