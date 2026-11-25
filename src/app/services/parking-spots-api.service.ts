
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ParkingSpotApiResponse {
  id: number;
  floor: string;
  spot: string;
  status: string;
}

@Injectable({
  providedIn: 'root'
})
export class ParkingSpotsApiService {

  private readonly http = inject(HttpClient);

  private readonly apiUrl =
    'http://localhost:8080/api/v1/parking-spots';

  getSpots(): Observable<ParkingSpotApiResponse[]> {
    return this.http.get<ParkingSpotApiResponse[]>(
      this.apiUrl
    );
  }
}
