
import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';

import { Router, RouterLink } from '@angular/router';

import {
  EMPTY,
  catchError,
  switchMap,
  timer
} from 'rxjs';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  FloorId,
  ParkingSpot,
  SpotStatus
} from '../../services/parking-lot.service';

import {
  ParkingSpotsApiService,
  ParkingSpotApiResponse
} from '../../services/parking-spots-api.service';

interface SpotRow {
  label: string;
  spots: ParkingSpot[];
}

@Component({
  selector: 'app-parking-spaces',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './parking-spaces.html',
  styleUrl: './parking-spaces.scss',
})
export class ParkingSpaces implements OnInit {

  private readonly router = inject(Router);

  private readonly api = inject(ParkingSpotsApiService);

  private readonly destroyRef = inject(DestroyRef);

  readonly floors: FloorId[] = ['B1', 'B2'];

  readonly activeFloor = signal<FloorId>('B1');

  readonly selectedSpot = signal<string | null>(null);

  readonly spots = signal<ParkingSpot[]>([]);

  readonly loading = signal(true);

  readonly error = signal('');

  // =====================================
  // LẤY VỊ TRÍ THEO TẦNG
  // =====================================

  readonly currentSpots = computed(() =>
    this.spots()
      .filter(spot => spot.floor === this.activeFloor())
      .sort((a, b) => a.id.localeCompare(b.id))
  );

  // =====================================
  // THỐNG KÊ TRẠNG THÁI
  // =====================================

  readonly availableCount = computed(() =>
    this.currentSpots().filter(
      spot => spot.status === 'available'
    ).length
  );

  readonly occupiedCount = computed(() =>
    this.currentSpots().filter(
      spot => spot.status === 'occupied'
    ).length
  );

  readonly reservedCount = computed(() =>
    this.currentSpots().filter(
      spot => spot.status === 'reserved'
    ).length
  );

  readonly maintenanceCount = computed(() =>
    this.currentSpots().filter(
      spot => spot.status === 'maintenance'
    ).length
  );

  // =====================================
  // SƠ ĐỒ VỊ TRÍ
  // =====================================

  readonly spotRows = computed<SpotRow[]>(() => [
    {
      label: 'A',
      spots: this.currentSpots()
    }
  ]);

  // =====================================
  // ĐỒNG BỘ VỚI BACKEND
  // =====================================

  ngOnInit(): void {

    timer(0, 5000).pipe(

      switchMap(() =>
        this.api.getSpots().pipe(

          catchError(error => {

            console.error(
              'Lỗi lấy danh sách chỗ đỗ:',
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
          (spot): spot is ParkingSpot => spot !== null
        );

      this.spots.set(mappedSpots);

      this.loading.set(false);

      this.error.set('');

      // Nếu vị trí vừa chọn không còn trống,
      // bỏ lựa chọn để tránh tạo booking sai.

      const selected = this.selectedSpot();

      if (
        selected &&
        !mappedSpots.some(
          spot =>
            spot.floor === this.activeFloor() &&
            spot.id === selected &&
            spot.status === 'available'
        )
      ) {
        this.selectedSpot.set(null);
      }

    });
  }

  // =====================================
  // CHUYỂN DỮ LIỆU BACKEND SANG FRONTEND
  // =====================================

  private mapApiSpot(
    data: ParkingSpotApiResponse
  ): ParkingSpot | null {

    const floor =
      data.floor === 'B1' || data.floor === 'B2'
        ? data.floor
        : null;

    if (!floor || !data.spot) {
      return null;
    }

    let status: SpotStatus;

    switch (data.status.toUpperCase()) {

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
        // Không cho phép khách chọn vị trí.
        status = 'maintenance';
        break;
    }

    return {
      floor,
      id: data.spot,
      status
    };
  }

  // =====================================
  // CHỌN TẦNG
  // =====================================

  changeFloor(floor: FloorId): void {

    this.activeFloor.set(floor);

    this.selectedSpot.set(null);
  }

  // =====================================
  // CHỌN VỊ TRÍ
  // =====================================

  selectSpot(spot: ParkingSpot): void {

    if (spot.status !== 'available') {
      return;
    }

    this.selectedSpot.set(
      this.selectedSpot() === spot.id
        ? null
        : spot.id
    );
  }

  // =====================================
  // XÁC NHẬN VỊ TRÍ
  // =====================================

  confirmSelection(): void {

    const selected = this.selectedSpot();

    if (!selected || this.loading() || this.error()) {
      return;
    }

    const spot = this.currentSpots().find(
      item => item.id === selected
    );

    if (!spot || spot.status !== 'available') {
      this.selectedSpot.set(null);
      return;
    }

    void this.router.navigate(
      ['/customer/booking'],
      {
        queryParams: {
          floor: this.activeFloor(),
          spot: selected
        }
      }
    );
  }
}
