
import {
  Component,
  computed,
  inject,
  signal
} from '@angular/core';

import { RouterLink } from '@angular/router';

import {
  FloorId,
  SpotStatus
} from '../../services/parking-lot.service';

import {
  OperatorParkingStateService,
  OperatorParkingSpot
} from '../../services/operator-parking-state.service';

import { HttpErrorResponse } from '@angular/common/http';

import { ParkingSpotsApiService } 
  from '../../services/parking-spots-api.service';

@Component({
  selector: 'app-operator-spaces',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './operator-spaces.html',
  styleUrl: './operator-spaces.scss',
})
export class OperatorSpaces {

  // =====================================
  // KẾT NỐI BACKEND
  // =====================================

  readonly parkingState = inject(
    OperatorParkingStateService
  );

  readonly parkingApi = inject(
    ParkingSpotsApiService
  );

  // Giữ tên lot để tương thích với HTML hiện tại.
  // Dữ liệu bên trong đã chuyển sang Backend.

  readonly lot = this.parkingState;

  // =====================================
  // TRẠNG THÁI GIAO DIỆN
  // =====================================
  readonly updating = signal(false);

  readonly activeFloor = signal<FloorId>('B1');

  readonly selectedId = signal<
    OperatorParkingSpot['id'] | null
  >(null);

  readonly notice = signal<string | null>(null);

  // =====================================
  // DANH SÁCH CHỖ ĐỖ THEO TẦNG
  // =====================================

  readonly currentSpots = computed(() =>
    this.parkingState.spotsOnFloor(
      this.activeFloor()
    )
  );

  // =====================================
  // SỐ CHỖ TRỐNG THEO TẦNG
  // =====================================

  readonly freeOnFloor = computed(() =>
    this.currentSpots().filter(
      spot => spot.status === 'available'
    ).length
  );

  // =====================================
  // VỊ TRÍ ĐANG ĐƯỢC CHỌN
  // =====================================

  readonly selectedSpot = computed(() =>
    this.currentSpots().find(
      spot => spot.id === this.selectedId()
    ) ?? null
  );

  // =====================================
  // CHUYỂN TẦNG
  // =====================================

  changeFloor(floor: FloorId): void {

    this.activeFloor.set(floor);

    this.selectedId.set(null);

    this.notice.set(null);

  }

  // =====================================
  // CHỌN VỊ TRÍ ĐỖ
  // =====================================

  selectSpot(
    spot: OperatorParkingSpot
  ): void {

    this.selectedId.set(spot.id);

    this.notice.set(null);

  }

  // =====================================
  // HIỂN THỊ TÊN TRẠNG THÁI
  // =====================================

  statusLabel(
    status: SpotStatus
  ): string {

    switch (status) {

      case 'available':
        return 'Còn trống';

      case 'occupied':
        return 'Đã có xe';

      case 'reserved':
        return 'Đã đặt';

      case 'maintenance':
        return 'Đang bảo trì';

      default:
        return 'Không xác định';

    }

  }

  // =====================================
  // BẢO TRÌ
  // =====================================


  // =====================================
  // BẬT / TẮT BẢO TRÌ
  // =====================================

  toggleMaintenance(): void {

    const spot = this.selectedSpot();

    if (!spot || this.updating()) {
      return;
    }

    // Chỉ thao tác với vị trí trống
    // hoặc đang bảo trì.

    if (
      spot.status !== 'available' &&
      spot.status !== 'maintenance'
    ) {
      this.notice.set(
        'Không thể bảo trì vị trí đã đặt hoặc đang có xe.'
      );
      return;
    }

    this.updating.set(true);
    this.notice.set(null);

    const isStarting =
      spot.status === 'available';

    const request = isStarting
      ? this.parkingApi.startMaintenance(spot.backendId)
      : this.parkingApi.endMaintenance(spot.backendId);

    request.subscribe({

      next: () => {

        this.updating.set(false);

        this.notice.set(
          isStarting
            ? `Đã chuyển vị trí ${spot.floor} - ${spot.id} sang bảo trì.`
            : `Đã kích hoạt lại vị trí ${spot.floor} - ${spot.id}.`
        );

      },

      error: (error: HttpErrorResponse) => {

        this.updating.set(false);

        const message =
          error.error?.message ||
          'Không thể cập nhật trạng thái vị trí.';

        this.notice.set(message);

      }

    });

  }


}
