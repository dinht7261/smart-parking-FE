
import {
  Injectable,
  inject,
  signal
} from '@angular/core';

import {
  HttpClient
} from '@angular/common/http';

import {
  Observable,
  tap
} from 'rxjs';

// =====================================
// KIỂU DỮ LIỆU BACKEND
// =====================================

export type PaymentStatus =
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED';

export type BackendPaymentMethod =
  | 'SIMULATED';

// =====================================
// RESPONSE TỪ SPRING BOOT
// =====================================


export interface PaymentResponse {

  id: number;

  paymentCode: string;

  sessionCode: string;

  licensePlate: string;

  checkInTime: string;

  checkOutTime: string;

  overnightRequested: boolean;

  // Thời gian gửi xe
  billableHours: number;

  parkingFee: number;

  // Phụ phí giữ chỗ do Check-in muộn
  reservationHoldHours: number;

  reservationHoldFee: number;

  // Phạt qua đêm
  violationNights: number;

  overnightPenalty: number;

  // Tổng tiền
  amount: number;

  paymentMethod: BackendPaymentMethod;

  status: PaymentStatus;

  paidAt: string | null;

  createdAt: string;
}


// =====================================
// API CONFIG
// =====================================

const API_URL =
  'http://localhost:8080/api/v1/payments';

// =====================================
// PAYMENT API SERVICE
// =====================================

@Injectable({
  providedIn: 'root'
})
export class PaymentApiService {

  private readonly http = inject(HttpClient);

  // =====================================
  // DANH SÁCH THANH TOÁN
  // =====================================

  readonly payments = signal<PaymentResponse[]>([]);

  // =====================================
  // 1. LẤY TOÀN BỘ LỊCH SỬ THANH TOÁN
  // =====================================

  refreshPayments(): Observable<PaymentResponse[]> {

    return this.http.get<PaymentResponse[]>(
      API_URL
    ).pipe(

      tap(payments => {
        this.payments.set(payments);
      })

    );

  }

  // =====================================
  // 2. TẠO HÓA ĐƠN TỪ SESSION
  // =====================================

  createPayment(
    sessionCode: string
  ): Observable<PaymentResponse> {

    return this.http.post<PaymentResponse>(
      `${API_URL}/sessions/${encodeURIComponent(sessionCode)}`,
      {}
    ).pipe(

      tap(payment => {
        this.upsertPayment(payment);
      })

    );

  }

  // =====================================
  // 3. TRA CỨU HÓA ĐƠN
  // =====================================

  getPayment(
    paymentCode: string
  ): Observable<PaymentResponse> {

    return this.http.get<PaymentResponse>(
      `${API_URL}/${encodeURIComponent(paymentCode)}`
    ).pipe(

      tap(payment => {
        this.upsertPayment(payment);
      })

    );

  }

  // =====================================
  // 4. XÁC NHẬN THANH TOÁN
  // =====================================

  confirmPayment(
    paymentCode: string
  ): Observable<PaymentResponse> {

    return this.http.post<PaymentResponse>(
      `${API_URL}/${encodeURIComponent(paymentCode)}/confirm`,
      {}
    ).pipe(

      tap(payment => {
        this.upsertPayment(payment);
      })

    );

  }

  // =====================================
  // 5. CẬP NHẬT SIGNAL
  // =====================================

  private upsertPayment(
    payment: PaymentResponse
  ): void {

    this.payments.update(current => {

      const index = current.findIndex(
        item => item.paymentCode === payment.paymentCode
      );

      if (index === -1) {
        return [
          payment,
          ...current
        ];
      }

      const updated = [...current];

      updated[index] = payment;

      return updated;

    });

  }

}
