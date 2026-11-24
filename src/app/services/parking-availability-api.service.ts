
import {
  Injectable,
  inject
} from '@angular/core';

import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// =====================================
// DỮ LIỆU TRẢ VỀ TỪ SPRING BOOT
// =====================================

export interface ParkingAvailabilityResponse {
  totalSpots: number;
  availableSpots: number;
  reservedSpots: number;
  occupiedSpots: number;
  maintenanceSpots: number;
  displayText: string;
}

// =====================================
// PARKING AVAILABILITY API
// =====================================

@Injectable({
  providedIn: 'root'
})
export class ParkingAvailabilityApiService {

  private readonly http = inject(HttpClient);

  private readonly apiUrl =
    'http://localhost:8080/api/v1/parking-availability';

  getAvailability():
    Observable<ParkingAvailabilityResponse> {

    return this.http.get<ParkingAvailabilityResponse>(
      this.apiUrl
    );
  }
}
