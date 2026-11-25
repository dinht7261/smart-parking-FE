
import {
  DestroyRef,
  Injectable,
  computed,
  inject,
  signal
} from '@angular/core';

import {
  takeUntilDestroyed
} from '@angular/core/rxjs-interop';

import {
  EMPTY,
  catchError,
  switchMap,
  timer
} from 'rxjs';

import {
  ParkingSpotsApiService,
  type ParkingSpotApiResponse
} from './parking-spots-api.service';

import type {
  FloorId,
  SpotStatus
} from './parking-lot.service';

// =====================================
// KIỂU DỮ LIỆU CHỖ ĐỖ OPERATOR
// =====================================

export interface OperatorParkingSpot {
  backendId: number;
  floor: FloorId;
  id: string;
  status: SpotStatus;
}

// =====================================
// OPERATOR PARKING STATE SERVICE
// =====================================

@Injectable({
  providedIn: 'root'
})
export class OperatorParkingStateService {

  private readonly api = inject(
    ParkingSpotsApiService
  );

  private readonly destroyRef = inject(
    DestroyRef
  );

  // =====================================
  // DANH SÁCH TẦNG
  // =====================================

  readonly floors: FloorId[] = [
    'B1',
    'B2'
  ];

  // =====================================
  // DỮ LIỆU CHỖ ĐỖ TỪ BACKEND
  // =====================================

  readonly spots = signal<OperatorParkingSpot[]>([]);

  readonly loading = signal(true);

  readonly error = signal('');

  readonly lastUpdatedAt = signal<Date | null>(null);

  // =====================================
  // THỐNG KÊ TỔNG QUAN
  // =====================================

  get totalCount(): number {
    return this.spots().length;
  }

  readonly availableCount = computed(() =>
    this.count('available')
  );

  readonly occupiedCount = computed(() =>
    this.count('occupied')
  );

  readonly reservedCount = computed(() =>
    this.count('reserved')
  );

  readonly maintenanceCount = computed(() =>
    this.count('maintenance')
  );

  readonly availablePercent = computed(() => {

    const total = this.totalCount;

    if (total === 0) {
      return 0;
    }

    return Math.round(
      this.availableCount() / total * 100
    );

  });

  // =====================================
  // TỰ ĐỘNG ĐỒNG BỘ BACKEND
  // =====================================

  constructor() {

    timer(0, 5000).pipe(

      switchMap(() =>

        this.api.getSpots().pipe(

          catchError(error => {

            console.error(
              'Không thể lấy dữ liệu chỗ đỗ từ Backend:',
              error
            );

            this.error.set(
              'Không thể cập nhật trạng thái từ Backend.'
            );

            this.loading.set(false);

            return EMPTY;

          })

        )

      ),

      takeUntilDestroyed(this.destroyRef)

    ).subscribe(data => {

      const mappedSpots = data

        .map(spot => this.mapApiSpot(spot))

        .filter(
          (spot): spot is OperatorParkingSpot =>
            spot !== null
        );

      // Cập nhật dữ liệu từ Backend.

      this.spots.set(mappedSpots);

      this.loading.set(false);

      this.error.set('');

      this.lastUpdatedAt.set(new Date());

    });

  }

  // =====================================
  // LẤY VỊ TRÍ THEO TẦNG
  // =====================================

  spotsOnFloor(
    floor: FloorId
  ): OperatorParkingSpot[] {

    return this.spots().filter(
      spot => spot.floor === floor
    );

  }

  totalOnFloor(
    floor: FloorId
  ): number {

    return this.spotsOnFloor(floor).length;

  }

  availableOnFloor(
    floor: FloorId
  ): number {

    return this.spotsOnFloor(floor).filter(
      spot => spot.status === 'available'
    ).length;

  }

  // =====================================
  // CHUYỂN RESPONSE BACKEND SANG FRONTEND
  // =====================================

  private mapApiSpot(
    data: ParkingSpotApiResponse
  ): OperatorParkingSpot | null {

    const floor =
      data.floor === 'B1' || data.floor === 'B2'
        ? data.floor
        : null;

    const id = data.spot?.trim().toUpperCase();

    if (!floor || !id) {
      return null;
    }

    let status: SpotStatus;

    switch (data.status?.toUpperCase()) {

      case 'AVAILABLE':
        status = 'available';
        break;

      case 'OCCUPIED':
        status = 'occupied';
        break;

      case 'RESERVED':
        status = 'reserved';
        break;

      case 'MAINTENANCE':
        status = 'maintenance';
        break;

      default:

        // Trạng thái không xác định:
        // Không cho phép xem là chỗ trống.

        status = 'maintenance';

        console.warn(
          'Trạng thái chỗ đỗ không xác định:',
          data
        );

        break;

    }

    return {
      backendId: data.id,
      floor,
      id,
      status
    };

  }

  // =====================================
  // ĐẾM THEO TRẠNG THÁI
  // =====================================

  private count(
    status: SpotStatus
  ): number {

    return this.spots().filter(
      spot => spot.status === status
    ).length;

  }

}
