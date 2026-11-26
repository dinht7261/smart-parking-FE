
import {
  Injectable,
  inject
} from '@angular/core';

import {
  HttpClient,
  HttpParams
} from '@angular/common/http';

import {
  Observable
} from 'rxjs';

// =====================================
// TRẠNG THÁI RESERVATION TỪ BACKEND
// =====================================

export type ReservationApiStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'CHECKED_IN'
  | 'COMPLETED';

// =====================================
// RESPONSE TỪ SPRING BOOT
// =====================================

export interface ReservationApiResponse {

  id: number;

  reservationCode: string;

  customerName: string;

  phone: string | null;

  licensePlate: string;

  floor: string;

  spot: string;

  startTime: string;

  endTime: string | null;

  status: ReservationApiStatus;

  createdAt: string;

}

// =====================================
// REQUEST TẠO RESERVATION
// =====================================

export interface CreateReservationRequest {

  userCode: string;

  spotId: number;

  startTime: string;

  endTime: string | null;

  phone?: string | null;

  overnightRequested: boolean;

}

// =====================================
// RESERVATION API SERVICE
// =====================================

@Injectable({
  providedIn: 'root'
})
export class ReservationApiService {

  private readonly http = inject(HttpClient);

  private readonly apiUrl =
    'http://localhost:8080/api/v1/reservations';

  // =====================================
  // 1. TẠO RESERVATION
  // =====================================

  create(
    request: CreateReservationRequest
  ): Observable<ReservationApiResponse> {

    return this.http.post<ReservationApiResponse>(
      this.apiUrl,
      request
    );

  }

  // =====================================
  // 2. LẤY TOÀN BỘ RESERVATION
  // DÀNH CHO OPERATOR
  // =====================================

  getAll(): Observable<ReservationApiResponse[]> {

    return this.http.get<ReservationApiResponse[]>(
      this.apiUrl
    );

  }

  // =====================================
  // 3. LẤY RESERVATION THEO USER
  // =====================================

  getByUser(
    userCode: string
  ): Observable<ReservationApiResponse[]> {

    return this.http.get<ReservationApiResponse[]>(
      `${this.apiUrl}/user/${encodeURIComponent(userCode)}`
    );

  }

  // =====================================
  // 4. OPERATOR DUYỆT RESERVATION
  // =====================================

  confirm(
    reservationCode: string
  ): Observable<ReservationApiResponse> {

    return this.http.patch<ReservationApiResponse>(
      `${this.apiUrl}/${encodeURIComponent(reservationCode)}/confirm`,
      null
    );

  }

  // =====================================
  // 5. OPERATOR TỪ CHỐI RESERVATION
  // =====================================

  reject(
    reservationCode: string
  ): Observable<ReservationApiResponse> {

    return this.http.patch<ReservationApiResponse>(
      `${this.apiUrl}/${encodeURIComponent(reservationCode)}/reject`,
      null
    );

  }

  // =====================================
  // 6. CUSTOMER HỦY RESERVATION
  // =====================================

  cancel(
    reservationCode: string,
    userCode: string
  ): Observable<ReservationApiResponse> {

    const params = new HttpParams()
      .set('userCode', userCode);

    return this.http.patch<ReservationApiResponse>(
      `${this.apiUrl}/${encodeURIComponent(reservationCode)}/cancel`,
      null,
      { params }
    );

  }

}
