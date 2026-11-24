import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FloorId, ParkingLotService, ParkingSpot, SpotStatus } from '../../services/parking-lot.service';

@Component({
  selector: 'app-operator-spaces',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './operator-spaces.html',
  styleUrl: './operator-spaces.scss',
})
export class OperatorSpaces {
  readonly lot = inject(ParkingLotService);
  readonly activeFloor = signal<FloorId>('B1');
  readonly selectedId = signal<ParkingSpot['id'] | null>(null);
  readonly notice = signal<string | null>(null);
  readonly currentSpots = computed(() => this.lot.spotsOnFloor(this.activeFloor()));
  readonly freeOnFloor = computed(() => this.currentSpots().filter((spot) => spot.status === 'available').length);
  readonly selectedSpot = computed(() => this.currentSpots().find((spot) => spot.id === this.selectedId()) ?? null);

  changeFloor(floor: FloorId): void {
    this.activeFloor.set(floor);
    this.selectedId.set(null);
    this.notice.set(null);
  }

  selectSpot(spot: ParkingSpot): void {
    this.selectedId.set(spot.id);
    this.notice.set(null);
  }

  statusLabel(status: SpotStatus): string {
    switch (status) {
      case 'available': return 'Còn trống';
      case 'occupied': return 'Đã có xe';
      case 'reserved': return 'Đã đặt';
      case 'maintenance': return 'Tạm ngưng bảo trì';
    }
  }

  toggleMaintenance(): void {
    const spot = this.selectedSpot();
    if (!spot) return;
    const wasClosed = spot.status === 'maintenance';
    const changed = this.lot.toggleMaintenance(spot.floor, spot.id);
    if (changed) this.notice.set(
      wasClosed
        ? `Đã mở lại chỗ ${spot.floor} - ${spot.id} cho người dùng.`
        : `Đã tạm ngưng chỗ ${spot.floor} - ${spot.id} để bảo trì.`,
    );
  }
}
