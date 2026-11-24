import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FloorId, ParkingLotService, ParkingSpot } from '../../services/parking-lot.service';

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
export class ParkingSpaces {
  private readonly router = inject(Router);
  readonly lot = inject(ParkingLotService);
  readonly floors = this.lot.floors;
  readonly activeFloor = signal<FloorId>('B1');
  readonly selectedSpot = signal<string | null>(null);
  readonly confirmedSpot = signal<string | null>(null);

  readonly currentSpots = computed(() => this.lot.spotsOnFloor(this.activeFloor()));
  readonly availableCount = computed(() => this.currentSpots().filter((spot) => spot.status === 'available').length);
  readonly occupiedCount = computed(() => this.currentSpots().filter((spot) => spot.status === 'occupied').length);
  readonly reservedCount = computed(() => this.currentSpots().filter((spot) => spot.status === 'reserved').length);
  readonly maintenanceCount = computed(() => this.currentSpots().filter((spot) => spot.status === 'maintenance').length);
  readonly spotRows = computed<SpotRow[]>(() =>
    [{ label: 'A', spots: this.currentSpots() }],
  );

  changeFloor(floor: FloorId): void {
    this.activeFloor.set(floor);
    this.selectedSpot.set(null);
    this.confirmedSpot.set(null);
  }

  selectSpot(spot: ParkingSpot): void {
    if (spot.status !== 'available') return;
    this.selectedSpot.set(this.selectedSpot() === spot.id ? null : spot.id);
    this.confirmedSpot.set(null);
  }

confirmSelection(): void {

  const selected = this.selectedSpot();

  if (!selected) {
    return;
  }

  // Kiểm tra vị trí vẫn còn trống
  const spot = this.currentSpots().find(
    item => item.id === selected
  );

  if (!spot || spot.status !== 'available') {
    return;
  }

  // Chuyển sang màn hình tạo yêu cầu
  void this.router.navigate(['/customer/booking'], {
    queryParams: {
      floor: this.activeFloor(),
      spot: selected
    }
  });

}
}
