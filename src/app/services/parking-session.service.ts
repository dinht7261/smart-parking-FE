
import {
  Injectable,
  inject,
  signal,
  computed
} from '@angular/core';

import {
  HttpClient
} from '@angular/common/http';

import {
  Observable,
  map,
  tap
} from 'rxjs';

import {
  type FloorId,
  type ParkingSpot
} from './parking-lot.service';

import {
  DemoUserService,
  type DemoUserId
} from './demo-user.service';

import {
  BarrierService
} from './barrier.service';


// =====================================
// KIỂU TRẠNG THÁI BACKEND
// =====================================

export type ParkingSessionStatus =
  | 'ACTIVE'
  | 'AWAITING_PAYMENT'
  | 'COMPLETED'
  | 'CANCELLED';

export type ParkingSessionType =
  | 'WALK_IN'
  | 'RESERVATION';

// =====================================
// DỮ LIỆU PHIÊN GỬI XE FRONTEND
// =====================================

export interface ParkingSession {

  // Giữ tương thích với giao diện cũ.
  id: string;

  // Mã phiên chính thức từ Backend.
  sessionCode: string;

  // ID database.
  backendId: number;

  userId?: DemoUserId | null;

  plate: string;

  floor: FloorId;

  spot: ParkingSpot['id'];

  checkInAt: string;

  checkOutAt: string | null;

  // Thông tin bổ sung từ Backend.
  sessionType: ParkingSessionType;

  customerName: string | null;

  phone: string | null;

  reservationCode: string | null;

  status: ParkingSessionStatus;

  createdAt: string;

  updatedAt: string;
}

// =====================================
// DTO NHẬN TỪ SPRING BOOT
// =====================================

interface ParkingSessionApiResponse {

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
// DTO GỬI CHECK-IN
// =====================================


export interface ParkingSessionCheckInRequest {

  qrPayload: string;


  customerName?: string;

  phone?: string;

  licensePlate?: string;

  reservationCode?: string;

  userCode?: string;

  overnightRequested?: boolean;
}


// =====================================
// KẾT QUẢ CẢM BIẾN
// =====================================

export interface SensorResult {

  ok: boolean;

  message: string;
}

// =====================================
// API CONFIG
// =====================================

const API_URL =
  'http://localhost:8080/api/v1/parking-sessions';

// =====================================
// PARKING SESSION SERVICE
// =====================================

@Injectable({
  providedIn: 'root'
})
export class ParkingSessionService {


  private readonly http = inject(HttpClient);

  private readonly users = inject(
    DemoUserService
  );
  private readonly barrier = inject(
  BarrierService
);
  // =====================================
  // DANH SÁCH PHIÊN GỬI XE
  // =====================================

  readonly sessions = signal<ParkingSession[]>([]);

  // =====================================
  // DANH SÁCH RIÊNG CỦA USER
  // =====================================

  readonly mySessions = computed(() => {

    const userId = this.users.selectedUserId();

    if (!userId) {
      return [];
    }

    return this.sessions().filter(session =>
      this.users.isPlateOwnedByUser(
        session.plate,
        userId
      )
    );

  });

  // Xe đang gửi của User.

  readonly myActiveSession = computed(() =>

    this.mySessions().find(
      session => session.status === 'ACTIVE'
    ) ?? null

  );

  // =====================================
  // THỐNG KÊ TOÀN HỆ THỐNG
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
      session => session.status === 'COMPLETED'
    ).length

  );

  // =====================================
  // THỐNG KÊ RIÊNG TỪNG USER
  // =====================================

  readonly myActiveCount = computed(() =>

    this.mySessions().filter(
      session => session.status === 'ACTIVE'
    ).length

  );

  readonly myCompletedCount = computed(() =>

    this.mySessions().filter(
      session => session.status === 'COMPLETED'
    ).length

  );

  // =====================================
  // TỰ ĐỘNG ĐỒNG BỘ KHI SERVICE ĐƯỢC KHỞI TẠO
  // =====================================

  constructor() {

    this.refreshSessions().subscribe({

      error: error => {

        console.error(
          'Không thể tải lịch sử gửi xe từ Backend:',
          error
        );

      }

    });

  }

  // =====================================
  // 1. LẤY TOÀN BỘ LỊCH SỬ GỬI XE
  // =====================================

  refreshSessions(): Observable<ParkingSession[]> {

    return this.http.get<ParkingSessionApiResponse[]>(
      `${API_URL}/history`
    ).pipe(

      map(response =>
        response.map(item => this.mapFromApi(item))
      ),

      tap(sessions =>
        this.sessions.set(sessions)
      )

    );

  }

  // =====================================
  // 2. LẤY DANH SÁCH XE ĐANG GỬI
  // =====================================

  refreshActiveSessions(): Observable<ParkingSession[]> {

    return this.http.get<ParkingSessionApiResponse[]>(
      `${API_URL}/active`
    ).pipe(

      map(response =>
        response.map(item => this.mapFromApi(item))
      ),

      tap(sessions => {

        sessions.forEach(session =>
          this.upsertSession(session)
        );

      })

    );

  }

  // =====================================
  // 3. TRA CỨU PHIÊN THEO MÃ
  // =====================================

  getSessionByCode(
    sessionCode: string
  ): Observable<ParkingSession> {

    return this.http.get<ParkingSessionApiResponse>(
      `${API_URL}/${encodeURIComponent(sessionCode)}`
    ).pipe(

      map(response =>
        this.mapFromApi(response)
      ),

      tap(session =>
        this.upsertSession(session)
      )

    );

  }

  // =====================================
  // 4. CHECK-IN
  // =====================================



checkIn(
  request: ParkingSessionCheckInRequest
): Observable<ParkingSession> {

  // Lấy User đang được chọn trên giao diện
  const userCode = this.users.selectedUserId();

  // Đảm bảo thông tin Check-in thuộc đúng User
  const payload: ParkingSessionCheckInRequest = {
    ...request,
    userCode
  };

  return this.http.post<ParkingSessionApiResponse>(
    `${API_URL}/check-in`,
    payload
  ).pipe(

    // Chuyển dữ liệu Backend sang Frontend
    map(response =>
      this.mapFromApi(response)
    ),

    tap(session => {

      // 1. Cập nhật danh sách phiên gửi xe
      this.upsertSession(session);

      // 2. Nhận diện khách và tự động mở barrier IN
      this.barrier.openEntryAfterCheckIn({

        userCode,

        customerName: session.customerName,

        licensePlate: session.plate,

        sessionCode: session.sessionCode,

        // Lấy kết quả phân loại từ Backend
        sessionType: session.sessionType

      });

    })

  );

}



  // =====================================
  // 5. CHECK-OUT
  // =====================================

  checkOut(
    sessionCode: string
  ): Observable<ParkingSession> {

    return this.http.post<ParkingSessionApiResponse>(
      `${API_URL}/${encodeURIComponent(sessionCode)}/check-out`,
      {}
    ).pipe(

      map(response =>
        this.mapFromApi(response)
      ),

      tap(session =>
        this.upsertSession(session)
      )

    );

  }

  // =====================================
  // 6. CHUYỂN ĐỔI DỮ LIỆU BACKEND -> FRONTEND
  // =====================================

  private mapFromApi(
    dto: ParkingSessionApiResponse
  ): ParkingSession {

    return {

      // Giữ id dạng string cho Frontend cũ.
      id: dto.sessionCode,

      sessionCode: dto.sessionCode,

      backendId: dto.id,

      plate: dto.licensePlate,

      floor: dto.floorCode as FloorId,

      spot: dto.spotCode as ParkingSpot['id'],

      checkInAt: dto.checkInTime,

      checkOutAt: dto.checkOutTime,

      sessionType: dto.sessionType,

      customerName: dto.customerName,

      phone: dto.phone,

      reservationCode: dto.reservationCode,

      status: dto.status,

      createdAt: dto.createdAt,

      updatedAt: dto.updatedAt

    };

  }

  // =====================================
  // 7. CẬP NHẬT PHIÊN TRONG SIGNAL
  // =====================================

  private upsertSession(
    session: ParkingSession
  ): void {

    this.sessions.update(current => {

      const index = current.findIndex(
        item => item.sessionCode === session.sessionCode
      );

      if (index === -1) {

        return [
          session,
          ...current
        ];

      }

      const updated = [...current];

      updated[index] = session;

      return updated;

    });

  }

  // =====================================
  // 8. VÔ HIỆU HÓA GIẢ LẬP XE VÀO
  // =====================================

  simulateEntry(
    _plateInput: string,
    _floor: FloorId,
    _spot: ParkingSpot['id']
  ): SensorResult {

    return {

      ok: false,

      message:
        'Chức năng mô phỏng xe vào đã tắt. ' +
        'Hệ thống đang chờ tín hiệu phần cứng.'

    };

  }

  // =====================================
  // 9. VÔ HIỆU HÓA GIẢ LẬP XE RA
  // =====================================

  simulateExit(
    _sessionId: string
  ): SensorResult {

    return {

      ok: false,

      message:
        'Xe chỉ được check-out thông qua ' +
        'nghiệp vụ thanh toán.'

    };

  }

}
