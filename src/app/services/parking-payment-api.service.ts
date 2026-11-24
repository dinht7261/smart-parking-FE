
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
// RESPONSE TỪ SPRING BOOT
// =====================================
// =====================================
// ENUM ĐỒNG BỘ VỚI BACKEND
// =====================================

export type PaymentMethod = 'SIMULATED';

export type PaymentStatus =
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED';

export interface PaymentApiResponse {

  id: number;

  paymentCode: string;

  sessionCode: string;

  licensePlate: string;

  checkInTime: string;

  checkOutTime: string | null;

  overnightRequested: boolean;

  billableHours: number;

  parkingFee: number;

  violationNights: number;

  overnightPenalty: number;

  amount: number;

  paymentMethod: PaymentMethod | null;

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
// PARKING PAYMENT API SERVICE
// =====================================

@Injectable({
  providedIn: 'root'
})

export class ParkingPaymentApiService {

  private readonly http = inject(HttpClient);

  // Danh sách hóa đơn từ Backend
  readonly payments =
    signal<PaymentApiResponse[]>([]);

  // =====================================
  // 1. TẠO HÓA ĐƠN
  // =====================================

  createPayment(
    sessionCode: string
  ): Observable<PaymentApiResponse> {

    return this.http.post<PaymentApiResponse>(
      `${API_URL}/sessions/${encodeURIComponent(sessionCode)}`,
      {}
    ).pipe(

      tap(payment =>
        this.upsertPayment(payment)
      )

    );
  }

  // =====================================
  // 2. LẤY CHI TIẾT HÓA ĐƠN
  // =====================================

  getPayment(
    paymentCode: string
  ): Observable<PaymentApiResponse> {

    return this.http.get<PaymentApiResponse>(
      `${API_URL}/${encodeURIComponent(paymentCode)}`
    ).pipe(

      tap(payment =>
        this.upsertPayment(payment)
      )

    );
  }

  // =====================================
  // 3. XÁC NHẬN THANH TOÁN
  // =====================================

  confirmPayment(
    paymentCode: string
  ): Observable<PaymentApiResponse> {

    return this.http.post<PaymentApiResponse>(
      `${API_URL}/${encodeURIComponent(paymentCode)}/confirm`,
      {}
    ).pipe(

      tap(payment =>
        this.upsertPayment(payment)
      )

    );
  }

  // =====================================
  // 4. LẤY LỊCH SỬ THANH TOÁN
  // =====================================

  getPaymentHistory(): Observable<PaymentApiResponse[]> {

    return this.http.get<PaymentApiResponse[]>(
      API_URL
    ).pipe(

      tap(payments =>
        this.payments.set(payments)
      )

    );
  }

  // =====================================
  // 5. CẬP NHẬT HÓA ĐƠN TRONG SIGNAL
  // =====================================

  private upsertPayment(
    payment: PaymentApiResponse
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
