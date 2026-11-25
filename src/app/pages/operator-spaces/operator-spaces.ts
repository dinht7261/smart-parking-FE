
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

  // Giữ tên lot để tương thích với HTML hiện tại.
  // Dữ liệu bên trong đã chuyển sang Backend.

  readonly lot = this.parkingState;

  // =====================================
  // TRẠNG THÁI GIAO DIỆN
  // =====================================

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
        return 'Tạm ngưng bảo trì';

      default:
        return 'Không xác định';

    }

  }

  // =====================================
  // BẢO TRÌ
  // =====================================

  toggleMaintenance(): void {

    const spot = this.selectedSpot();

    if (!spot) {
      return;
    }

    // Chưa thực hiện cập nhật tại đây.
    // Backend hiện chưa có API bảo trì.

    this.notice.set(
      `Vị trí ${spot.floor} - ${spot.id}: ` +
      'Chức năng bảo trì đang chờ kết nối API Backend.'
    );

  }

}
