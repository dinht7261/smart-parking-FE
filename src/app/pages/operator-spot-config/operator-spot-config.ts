
import {
  Component,
  computed,
  inject,
  signal
} from '@angular/core';

import { RouterLink } from '@angular/router';

import {
  ParkingLotService,
  type FloorId,
  type ParkingSpot,
  type SpotStatus
} from '../../services/parking-lot.service';

@Component({
  selector: 'app-operator-spot-config',
  standalone: true,
  imports: [RouterLink],

  template: `
    <main class="config-page">

      <header>
        <a routerLink="/operator" class="back-link">
          ← Quay lại trang chủ
        </a>

        <span class="eyebrow">
          QUẢN LÝ BÃI ĐỖ XE
        </span>

        <h1>Cấu hình chỗ đỗ</h1>

        <p>
          Quản lý số lượng vị trí trên từng tầng
        </p>
      </header>

      <section class="notice">
        <strong>Chế độ cấu hình FE</strong>
        <p>
          Dữ liệu đang lưu trên thiết bị.
          Chưa kết nối Backend hoặc cảm biến thật.
        </p>
      </section>

      <!-- THỐNG KÊ -->

      <section class="stats">

        <article>
          <span>Tổng vị trí</span>
          <strong>{{ lot.totalCount }}</strong>
        </article>

        <article>
          <span>Còn trống</span>
          <strong class="green">
            {{ lot.availableCount() }}
          </strong>
        </article>

        <article>
          <span>Đang đỗ</span>
          <strong>{{ lot.occupiedCount() }}</strong>
        </article>

        <article>
          <span>Bảo trì</span>
          <strong class="orange">
            {{ lot.maintenanceCount() }}
          </strong>
        </article>

      </section>

      <!-- CHỌN TẦNG -->

      <section class="panel">

        <h2>Chọn tầng</h2>

        <div class="floor-tabs">

          @for (floor of lot.floors; track floor) {

            <button
              type="button"
              [class.active]="selectedFloor() === floor"
              (click)="changeFloor(floor)"
            >
              Tầng {{ floor }}
            </button>

          }

        </div>

        <p class="floor-summary">
          {{ floorSpots().length }} vị trí tại tầng
          {{ selectedFloor() }}
        </p>

      </section>

      <!-- THÊM VỊ TRÍ -->

      <section class="panel">

        <h2>Thêm vị trí đỗ</h2>

        <p class="description">
          Ví dụ: A03, A04 hoặc B01.
          Vị trí mới sẽ ở trạng thái bảo trì.
        </p>

        <label for="newSpotCode">
          Mã vị trí
        </label>

        <input
          id="newSpotCode"
          type="text"
          maxlength="12"
          placeholder="Nhập A03..."
          [value]="spotCode()"
          (input)="spotCode.set($any($event.target).value)"
        />

        <button
          type="button"
          class="primary-button"
          (click)="addSpot()"
        >
          + Thêm vị trí
        </button>

      </section>

      <!-- THÔNG BÁO -->

      @if (feedback()) {

        <div
          class="feedback"
          [class.error]="feedbackError()"
          role="status"
        >
          {{ feedback() }}
        </div>

      }

      <!-- DANH SÁCH VỊ TRÍ -->

      <section class="panel">

        <div class="list-heading">

          <h2>
            Vị trí tầng {{ selectedFloor() }}
          </h2>

          <span>
            {{ floorSpots().length }} chỗ
          </span>

        </div>

        @if (floorSpots().length === 0) {

          <p class="empty">
            Tầng này chưa có vị trí đỗ.
          </p>

        } @else {

          @for (
            spot of floorSpots();
            track spot.id
          ) {

            <article class="spot-row">

              <div class="spot-main">

                <div
                  class="spot-icon"
                  [class.is-available]="
                    spot.status === 'available'
                  "
                >
                  P
                </div>

                <div>

                  <strong>{{ spot.id }}</strong>

                  <span
                    class="status"
                    [class.is-available]="
                      spot.status === 'available'
                    "
                    [class.is-occupied]="
                      spot.status === 'occupied'
                    "
                    [class.is-reserved]="
                      spot.status === 'reserved'
                    "
                  >
                    {{ statusText(spot.status) }}
                  </span>

                </div>

              </div>

              <div class="spot-actions">

                @if (
                  spot.status === 'available' ||
                  spot.status === 'maintenance'
                ) {

                  <button
                    type="button"
                    class="maintenance-button"
                    (click)="toggleMaintenance(spot)"
                  >
                    {{
                      spot.status === 'maintenance'
                        ? 'Kích hoạt'
                        : 'Bảo trì'
                    }}
                  </button>

                }

                @if (spot.status === 'maintenance') {

                  @if (pendingRemoval() === spot.id) {

                    <button
                      type="button"
                      class="delete-button"
                      (click)="removeSpot(spot)"
                    >
                      Xác nhận xóa
                    </button>

                    <button
                      type="button"
                      class="cancel-button"
                      (click)="pendingRemoval.set(null)"
                    >
                      Hủy
                    </button>

                  } @else {

                    <button
                      type="button"
                      class="delete-button"
                      (click)="pendingRemoval.set(spot.id)"
                    >
                      Xóa
                    </button>

                  }

                }

              </div>

            </article>

          }

        }

      </section>

      <p class="bottom-note">
        Chỉ xóa vị trí mới đang bảo trì và chưa được
        sử dụng. Trước khi tích hợp Backend cần kiểm tra
        thêm các booking và phiên xe liên quan.
      </p>

    </main>
  `,

  styles: [`

    :host {
      display: block;
    }

    * {
      box-sizing: border-box;
    }

    .config-page {
      min-height: 100dvh;
      padding: 20px 18px 80px;
      background: var(--cream);
      color: var(--ink);
    }

    header {
      margin-bottom: 22px;
    }

    .back-link {
      display: inline-flex;
      margin-bottom: 14px;
      color: var(--muted);
      font-size: 13px;
      font-weight: 700;
      text-decoration: none;
    }

    .eyebrow {
      display: block;
      color: var(--forest);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.08em;
    }

    h1 {
      margin: 8px 0 6px;
      font-size: 25px;
      font-weight: 800;
    }

    header p,
    .description,
    .floor-summary,
    .bottom-note {
      color: var(--muted);
      font-size: 13px;
      line-height: 1.55;
    }

    .notice {
      padding: 15px;
      margin-bottom: 16px;
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      background: var(--sand);
    }

    .notice strong {
      color: var(--ink);
      font-size: 13px;
    }

    .notice p {
      margin: 5px 0 0;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.5;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 18px;
    }

    .stats article {
      padding: 15px;
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      background: var(--paper);
      box-shadow: var(--shadow-sm);
    }

    .stats span {
      display: block;
      margin-bottom: 6px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 600;
    }

    .stats strong {
      font-size: 25px;
      font-weight: 800;
      color: var(--ink);
      font-variant-numeric: tabular-nums;
    }

    .stats strong.green {
      color: var(--status-free);
    }

    .stats strong.orange {
      color: var(--status-maint);
    }

    .panel {
      padding: 16px;
      margin-bottom: 16px;
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      background: var(--paper);
      box-shadow: var(--shadow-sm);
    }

    .panel h2 {
      margin: 0 0 12px;
      font-size: 16px;
      font-weight: 800;
    }

    .floor-tabs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      padding: 5px;
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      background: var(--sand);
    }

    .floor-tabs button {
      min-height: 44px;
      border: 0;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--muted);
      font-size: 13px;
      font-weight: 750;
      cursor: pointer;
    }

    .floor-tabs button.active {
      background: var(--surface-dark);
      color: var(--paper);
    }

    label {
      display: block;
      margin-bottom: 8px;
      font-size: 13px;
      font-weight: 700;
    }

    input {
      width: 100%;
      min-height: 46px;
      padding: 12px 14px;
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      background: var(--cream);
      color: var(--ink);
      font-family: var(--font-mono);
      font-size: 14px;
      text-transform: uppercase;
    }

    .primary-button {
      width: 100%;
      min-height: 48px;
      margin-top: 12px;
      border: 0;
      border-radius: var(--radius-sm);
      background: var(--signal);
      color: var(--surface-dark);
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
    }

    .feedback {
      padding: 13px;
      margin-bottom: 16px;
      border: 1px solid var(--status-free-border);
      border-radius: var(--radius-sm);
      background: var(--status-free-bg);
      color: var(--status-free);
      font-size: 13px;
      font-weight: 600;
      line-height: 1.5;
    }

    .feedback.error {
      border-color: var(--status-danger-border);
      background: var(--status-danger-bg);
      color: var(--status-danger);
    }

    .list-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .list-heading span {
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
    }

    .spot-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      padding: 13px 0;
      border-top: 1px solid var(--line);
    }

    .spot-main {
      display: flex;
      align-items: center;
      gap: 11px;
    }

    .spot-main strong {
      display: block;
      margin-bottom: 3px;
      font-family: var(--font-mono);
      font-size: 14px;
    }

    .spot-icon {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: var(--radius-sm);
      background: var(--sand);
      color: var(--ink);
      font-weight: 900;
    }

    .spot-icon.is-available {
      background: var(--status-free-bg);
      color: var(--status-free);
    }

    .status {
      color: var(--status-maint);
      font-size: 12px;
      font-weight: 700;
    }

    .status.is-available {
      color: var(--status-free);
    }

    .status.is-occupied {
      color: var(--status-occupied);
    }

    .status.is-reserved {
      color: var(--status-reserved);
    }

    .spot-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .spot-actions button {
      min-height: 36px;
      padding: 7px 11px;
      border: 0;
      border-radius: var(--radius-sm);
      font-size: 12px;
      font-weight: 750;
      cursor: pointer;
    }

    .maintenance-button {
      background: var(--sand);
      color: var(--ink);
    }

    .delete-button {
      background: var(--status-danger-bg);
      color: var(--status-danger);
    }

    .cancel-button {
      background: var(--sand);
      color: var(--muted);
    }

    .empty {
      color: var(--muted);
      font-size: 13px;
    }

    .bottom-note {
      padding: 0 4px;
    }

  `]
})
export class OperatorSpotConfig {

  readonly lot = inject(ParkingLotService);

  readonly selectedFloor = signal<FloorId>('B1');

  readonly spotCode = signal('A03');

  readonly feedback = signal('');

  readonly feedbackError = signal(false);

  readonly pendingRemoval = signal<string | null>(null);

  readonly floorSpots = computed(() =>
    this.lot.spotsOnFloor(this.selectedFloor())
  );


  changeFloor(floor: FloorId): void {

    this.selectedFloor.set(floor);
    this.pendingRemoval.set(null);
    this.feedback.set('');
  }


  addSpot(): void {

    const id = this.spotCode()
      .trim()
      .toUpperCase();

    const ok = this.lot.addSpot(
      this.selectedFloor(),
      id
    );

    this.feedbackError.set(!ok);

    this.feedback.set(
      ok
        ? `Đã thêm vị trí ${this.selectedFloor()}-${id}.`
        : 'Không thể thêm vị trí. Kiểm tra mã, vị trí trùng hoặc giới hạn.'
    );

    if (ok) {
      this.spotCode.set('');
    }
  }


  toggleMaintenance(spot: ParkingSpot): void {

    const ok = this.lot.toggleMaintenance(
      spot.floor,
      spot.id
    );

    this.feedbackError.set(!ok);

    this.feedback.set(
      ok
        ? `Đã cập nhật ${spot.floor}-${spot.id}.`
        : 'Không thể thay đổi trạng thái vị trí.'
    );

    this.pendingRemoval.set(null);
  }


  removeSpot(spot: ParkingSpot): void {

    // Giao diện chỉ cho phép xóa vị trí
    // đang bảo trì, không có xe.
    if (spot.status !== 'maintenance') {
      this.feedbackError.set(true);
      this.feedback.set(
        'Chỉ được xóa vị trí đang bảo trì.'
      );
      return;
    }

    const ok = this.lot.removeSpot(
      spot.floor,
      spot.id
    );

    this.feedbackError.set(!ok);

    this.feedback.set(
      ok
        ? `Đã xóa vị trí ${spot.floor}-${spot.id}.`
        : 'Không thể xóa vị trí này.'
    );

    this.pendingRemoval.set(null);
  }


  statusText(status: SpotStatus): string {

    switch (status) {

      case 'available':
        return 'Trống';

      case 'occupied':
        return 'Đang đỗ';

      case 'reserved':
        return 'Đã đặt';

      case 'maintenance':
        return 'Bảo trì';

    }
  }

}
