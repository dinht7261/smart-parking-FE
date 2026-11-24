
import {
  Injectable,
  inject
} from '@angular/core';

import {
  HttpClient
} from '@angular/common/http';

import {
  Observable
} from 'rxjs';

// =====================================
// KIỂU DỮ LIỆU CHECK-IN
// =====================================

export type ParkingSessionType =
  | 'WALK_IN'
  | 'RESERVATION';

export interface ParkingSessionCheckInRequest {

  qrPayload: string;

  sessionType: ParkingSessionType;

  reservationCode?: string;

  userCode?: string;

  customerName?: string;

  phone?: string;

  licensePlate?: string;

  overnightRequested: boolean;
}

// =====================================
// KIỂU DỮ LIỆU RESPONSE BACKEND
// =====================================

export type ParkingSessionStatus =
  | 'ACTIVE'
  | 'AWAITING_PAYMENT'
  | 'COMPLETED'
  | 'CANCELLED';

export interface ParkingSessionApiResponse {

  id: number;

  sessionCode: string;

  sessionType: ParkingSessionType;

  customerName: string | null;

  phone: string | null;

  licensePlate: string;

  spotId: number;

  floorCode: string;

  spotCode: string;

  reservationCode: string | null;

  checkInTime: string;

  checkOutTime: string | null;

  status: ParkingSessionStatus;

  createdAt: string;

  updatedAt: string;
}

// =====================================
// PARKING SESSION API SERVICE
// =====================================

@Injectable({
  providedIn: 'root'
})
export class ParkingSessionApiService {

  private readonly http = inject(HttpClient);

  private readonly apiUrl =
    'http://localhost:8080/api/v1/parking-sessions';

  // =====================================
  // 1. CHECK-IN
  // =====================================

  checkIn(
    request: ParkingSessionCheckInRequest
  ): Observable<ParkingSessionApiResponse> {

    return this.http.post<ParkingSessionApiResponse>(
      `${this.apiUrl}/check-in`,
      request
    );
  }

  // =====================================
  // 2. LẤY DANH SÁCH XE ĐANG GỬI
  // =====================================

  getActiveSessions():
    Observable<ParkingSessionApiResponse[]> {

    return this.http.get<ParkingSessionApiResponse[]>(
      `${this.apiUrl}/active`
    );
  }

  // =====================================
  // 3. LẤY LỊCH SỬ GỬI XE
  // =====================================

  getSessionHistory():
    Observable<ParkingSessionApiResponse[]> {

    return this.http.get<ParkingSessionApiResponse[]>(
      `${this.apiUrl}/history`
    );
  }

  // =====================================
  // 4. TRA CỨU PHIÊN GỬI XE
  // =====================================

  getSessionByCode(
    sessionCode: string
  ): Observable<ParkingSessionApiResponse> {

    return this.http.get<ParkingSessionApiResponse>(
      `${this.apiUrl}/${encodeURIComponent(sessionCode)}`
    );
  }

  // =====================================
  // 5. CHECK-OUT
  // =====================================

  checkOut(
    sessionCode: string
  ): Observable<ParkingSessionApiResponse> {

    return this.http.post<ParkingSessionApiResponse>(
      `${this.apiUrl}/${encodeURIComponent(sessionCode)}/check-out`,
      {}
    );
  }

}
