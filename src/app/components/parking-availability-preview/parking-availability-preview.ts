import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';

import {
  EMPTY,
  Subject,
  catchError,
  filter,
  merge,
  switchMap,
  timer
} from 'rxjs';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  ParkingAvailabilityApiService,
  type ParkingAvailabilityResponse
} from '../../services/parking-availability-api.service';

import { BarrierService } from '../../services/barrier.service';
import { AppIcon } from '../app-icon/app-icon';

@Component({
  selector: 'app-parking-availability-preview',
  standalone: true,
  imports: [AppIcon],

  template: `
    <section class="oled-section" aria-label="Bảng hiển thị OLED thời gian thực">

      <div class="oled-heading">
        <div>
          <h2>Màn hình OLED</h2>
          <p>Số chỗ khả dụng từ Backend</p>
        </div>

        <div class="oled-controls">
          <span
            class="live-indicator"
            [class.is-live]="telemetryState() === 'live'"
            [class.is-paused]="telemetryState() === 'paused'"
            [class.is-error]="telemetryState() === 'error'"
            [class.is-loading]="telemetryState() === 'loading'"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <span class="status-dot" aria-hidden="true"></span>
            <span>{{ statusLabel() }}</span>
          </span>

          <button
            type="button"
            class="oled-toggle-btn"
            [attr.aria-pressed]="paused()"
            [attr.aria-label]="paused() ? 'Tiếp tục cập nhật OLED tự động' : 'Tạm dừng cập nhật OLED tự động'"
            (click)="togglePause()"
          >
            <app-icon [name]="paused() ? 'play' : 'pause'" [size]="14" />
            <span>{{ paused() ? 'Tiếp tục' : 'Tạm dừng' }}</span>
          </button>
        </div>
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
        <p class="oled-error" role="alert">{{ error() }}</p>
      } @else {
        <p class="oled-note">
          @if (paused()) {
            Đã tạm dừng tự động cập nhật
          } @else {
            Tự động cập nhật mỗi 5 giây từ Spring Boot
          }
          @if (lastUpdatedText()) {
            · Cập nhật lúc {{ lastUpdatedText() }}
          }
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
      flex-wrap: wrap;
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

    .oled-controls {
      display: inline-flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }

    .live-indicator {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: var(--font-mono);
      font-size: 12px;
      border-radius: var(--radius-pill);
      padding: 6px 10px;
      font-weight: 800;
      border: 1px solid var(--line);
      background: var(--sand);
      color: var(--muted);
    }

    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: currentColor;
      flex-shrink: 0;
    }

    .live-indicator.is-live {
      color: var(--status-free);
      background: var(--status-free-bg);
      border-color: var(--status-free-border);
    }

    .live-indicator.is-live .status-dot {
      animation: oled-pulse 2s ease-in-out infinite;
    }

    .live-indicator.is-paused {
      color: var(--status-maint);
      background: var(--status-maint-bg);
      border-color: var(--status-maint-border);
    }

    .live-indicator.is-error {
      color: var(--status-danger);
      background: var(--status-danger-bg);
      border-color: var(--status-danger-border);
    }

    .live-indicator.is-loading {
      color: var(--status-reserved);
      background: var(--status-reserved-bg);
      border-color: var(--status-reserved-border);
    }

    .oled-toggle-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      min-height: 36px;
      padding: 6px 10px;
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      background: var(--cream);
      color: var(--ink);
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;

      &:hover {
        background: var(--sand);
        border-color: var(--leaf);
      }
    }

    @keyframes oled-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.45; }
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
      text-shadow: 0 0 18px rgba(80, 190, 255, .5);
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

  private readonly api = inject(ParkingAvailabilityApiService);
  readonly barrier = inject(BarrierService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly manualRefresh$ = new Subject<void>();

  readonly availability = signal<ParkingAvailabilityResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly paused = signal(false);
  readonly pageHidden = signal(typeof document !== 'undefined' ? document.hidden : false);
  readonly lastUpdated = signal<Date | null>(null);

  readonly telemetryState = computed<'live' | 'paused' | 'error' | 'loading'>(() => {
    if (this.paused()) {
      return 'paused';
    }
    if (this.error()) {
      return 'error';
    }
    if (this.loading() && !this.availability()) {
      return 'loading';
    }
    return this.availability() ? 'live' : 'loading';
  });

  readonly statusLabel = computed(() => {
    switch (this.telemetryState()) {
      case 'live':
        return 'LIVE';
      case 'paused':
        return 'TẠM DỪNG';
      case 'error':
        return 'MẤT KẾT NỐI';
      case 'loading':
        return 'ĐANG ĐỒNG BỘ';
    }
  });

  readonly lastUpdatedText = computed(() => {
    const dt = this.lastUpdated();
    if (!dt) {
      return '';
    }
    return new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(dt);
  });

  ngOnInit(): void {
    if (typeof document !== 'undefined') {
      const onVisibilityChange = () => {
        const hidden = document.hidden;
        this.pageHidden.set(hidden);
        if (!hidden && !this.paused()) {
          this.manualRefresh$.next();
        }
      };

      document.addEventListener('visibilitychange', onVisibilityChange);
      this.destroyRef.onDestroy(() => {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      });
    }

    merge(timer(0, 5000), this.manualRefresh$).pipe(
      filter(() => !this.paused() && !this.pageHidden()),
      switchMap(() =>
        this.api.getAvailability().pipe(
          catchError(error => {
            console.error('Lỗi lấy dữ liệu OLED:', error);
            this.availability.set(null);
            this.loading.set(false);
            this.error.set('Không thể lấy số chỗ từ Backend.');
            return EMPTY;
          })
        )
      ),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(data => {
      this.availability.set(data);
      this.loading.set(false);
      this.error.set('');
      this.lastUpdated.set(new Date());
    });
  }

  togglePause(): void {
    const nextPaused = !this.paused();
    this.paused.set(nextPaused);
    if (!nextPaused && !this.pageHidden()) {
      this.manualRefresh$.next();
    }
  }
}
