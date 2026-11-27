
import {
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal
} from '@angular/core';

import { EMPTY, catchError, switchMap, timer } from 'rxjs';

import { takeUntilDestroyed } from
  '@angular/core/rxjs-interop';

import {
  ParkingAvailabilityApiService,
  type ParkingAvailabilityResponse
} from '../../services/parking-availability-api.service';

import {
  BarrierService
} from '../../services/barrier.service';

@Component({
  selector: 'app-parking-availability-preview',
  standalone: true,

  template: `
    <section class="oled-section">

      <div class="oled-heading">
        <div>
          <h2>Màn hình OLED</h2>
          <p>Số chỗ khả dụng từ Backend</p>
        </div>

        <span class="live-indicator">
          ● LIVE
        </span>
      </div>

      <div class="oled-frame">

        <div class="oled-screen">

<div class="oled-title">
  SMART PARKING
</div>

<!-- NHẬN DIỆN KHÁCH VỪA CHECK-IN -->

@if (barrier.lastEntryRecognition(); as recognition) {

  <div class="oled-recognition">

    <div
      class="oled-recognition-type"
      [class.reservation]="recognition.sessionType === 'RESERVATION'"
      [class.walk-in]="recognition.sessionType === 'WALK_IN'"
    >

      {{ recognition.sessionType === 'RESERVATION'
        ? 'RESERVATION'
        : 'WALK-IN'
      }}

    </div>

    <div class="oled-recognition-plate">
      {{ recognition.licensePlate }}
    </div>

    <div class="oled-recognition-info">

      {{ recognition.customerName || recognition.userCode }}

    </div>

    <div class="oled-recognition-session">
      {{ recognition.sessionCode }}
    </div>

  </div>

}

          @if (availability(); as data) {

            <div class="oled-label">
              AVAILABLE SPOTS
            </div>

            <div class="oled-count">
              {{ data.displayText }}
            </div>

            <div class="oled-footer">
              RESERVED: {{ data.reservedSpots }}
              | OCCUPIED: {{ data.occupiedSpots }}
            </div>

          } @else if (loading()) {

            <div class="oled-message">
              CONNECTING...
            </div>

          } @else {

            <div class="oled-message">
              NO CONNECTION
            </div>

          }

        </div>

      </div>

      @if (error()) {
        <p class="oled-error">{{ error() }}</p>
      } @else {
        <p class="oled-note">
          Tự động cập nhật mỗi 5 giây từ Spring Boot
        </p>
      }

    </section>
  `,

  styles: [`
    .oled-section {
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      padding: 18px;
      margin: 18px 0;
      font-family: var(--font-sans);
      box-shadow: var(--shadow-sm);
    }

    .oled-heading {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 14px;
    }

    .oled-heading h2 {
      font-size: 16px;
      font-weight: 800;
      color: var(--ink);
      margin: 0 0 4px;
    }

    .oled-heading p {
      font-size: 13px;
      color: var(--muted);
      margin: 0;
    }

    .live-indicator {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--status-free);
      background: var(--status-free-bg);
      border: 1px solid var(--status-free-border);
      border-radius: var(--radius-pill);
      padding: 5px 10px;
      font-weight: 800;
      animation: oled-pulse 2s ease-in-out infinite;
    }

    @keyframes oled-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.65; }
    }

    .oled-frame {
      background: var(--surface-dark);
      border: 1px solid #2d363c;
      border-radius: var(--radius-md);
      padding: 14px;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), var(--shadow-md);
    }

    .oled-screen {
      background:
        repeating-linear-gradient(0deg, rgba(139, 220, 255, 0.03) 0 1px, transparent 1px 3px),
        #070d17;
      border: 2px solid #253858;
      border-radius: var(--radius-sm);
      min-height: 196px;
      padding: 16px 10px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      text-align: center;
      color: #8bdcff;
      font-family: var(--font-mono);
      font-variant-numeric: tabular-nums;
    }

    .oled-title {
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.16em;
    }

    /* NHẬN DIỆN KHÁCH CHECK-IN */

    .oled-recognition {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
      padding: 10px 0;
      border-top: 1px solid #253858;
      border-bottom: 1px solid #253858;
    }

    .oled-recognition-type {
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.14em;
    }

    .oled-recognition-type.reservation {
      color: #4ade80;
      text-shadow: 0 0 12px rgba(74, 222, 128, .5);
    }

    .oled-recognition-type.walk-in {
      color: #38bdf8;
      text-shadow: 0 0 12px rgba(56, 189, 248, .5);
    }

    .oled-recognition-plate {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: 0.14em;
      color: #ffffff;
    }

    .oled-recognition-info {
      font-size: 12px;
      color: #8bdcff;
    }

    .oled-recognition-session {
      font-size: 12px;
      color: #7bbad8;
    }

    .oled-label {
      font-size: 12px;
      letter-spacing: 0.1em;
      color: #7bbad8;
    }

    .oled-count {
      font-size: 58px;
      font-weight: 800;
      line-height: 1.1;
      text-shadow: 0 0 18px rgba(80,190,255,.5);
    }

    .oled-footer {
      font-size: 12px;
      color: #7bbad8;
    }

    .oled-message {
      font-size: 18px;
      font-weight: 700;
    }

    .oled-note {
      color: var(--muted);
      font-size: 12px;
      text-align: center;
      margin: 12px 0 0;
    }

    .oled-error {
      color: var(--status-danger);
      font-size: 12px;
      font-weight: 600;
      text-align: center;
      margin: 12px 0 0;
    }
  `]
})
export class ParkingAvailabilityPreview implements OnInit {

  private readonly api = inject(
    ParkingAvailabilityApiService
  );
  
  readonly barrier = inject(BarrierService);

  private readonly destroyRef = inject(DestroyRef);

  readonly availability =
    signal<ParkingAvailabilityResponse | null>(null);

  readonly loading = signal(true);

  readonly error = signal('');

  ngOnInit(): void {

    timer(0, 5000).pipe(

      switchMap(() =>
        this.api.getAvailability().pipe(

          catchError(error => {

            console.error(
              'Lỗi lấy dữ liệu OLED:',
              error
            );

            this.availability.set(null);
            this.loading.set(false);

            this.error.set(
              'Không thể lấy số chỗ từ Backend.'
            );

            return EMPTY;
          })

        )
      ),

      takeUntilDestroyed(this.destroyRef)

    ).subscribe(data => {

      this.availability.set(data);

      this.loading.set(false);

      this.error.set('');

    });
  }
}
