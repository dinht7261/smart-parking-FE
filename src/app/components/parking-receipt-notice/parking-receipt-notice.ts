
import {
  Component,
  HostListener,
  computed,
  inject,
  signal
} from '@angular/core';

import {
  NavigationEnd,
  Router
} from '@angular/router';

import {
  takeUntilDestroyed
} from '@angular/core/rxjs-interop';

import {
  ParkingReceiptService,
  type ParkingReceipt,
  type ReceiptRole
} from '../../services/parking-receipt.service';

import {
  DemoUserService
} from '../../services/demo-user.service';

import { AppIcon } from '../app-icon/app-icon';

@Component({
  selector: 'app-parking-receipt-notice',
  standalone: true,
  imports: [AppIcon],

  template: `

    <!-- POPUP HÓA ĐƠN -->

    @if (currentReceipt(); as receipt) {

      <div
        class="receipt-overlay"
        role="presentation"
      >

        <section
          class="receipt-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="receipt-title"
        >

          <div class="receipt-handle"></div>

          <div class="receipt-heading">

            <div class="receipt-icon" aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 3v18l3-2 3 2 2-2 2 2 3-2 3 2V3z" />
                <line x1="8" y1="8" x2="16" y2="8" />
                <line x1="8" y1="12" x2="16" y2="12" />
                <line x1="8" y1="16" x2="12" y2="16" />
              </svg>
            </div>

            <span class="receipt-success">
              <app-icon name="check" [size]="14" />
              <span>ĐÃ GHI NHẬN XE RA BÃI</span>
            </span>

            <h2 id="receipt-title">
              Hóa đơn gửi xe
            </h2>

            <p>
              Chi tiết thanh toán của lượt gửi xe
            </p>

          </div>


          <!-- THÔNG TIN XE -->

          <div class="receipt-vehicle">

            <span>Biển số xe</span>

            <strong>
              {{ receipt.plate }}
            </strong>

            <small>
              {{ receipt.floor }} - {{ receipt.spot }}
            </small>

          </div>


          <!-- THÔNG TIN THỜI GIAN -->

          <div class="receipt-details">

            <div>
              <span>Thời gian vào</span>

              <strong>
                {{ formatDate(receipt.checkInAt) }}
              </strong>
            </div>

            <div>
              <span>Thời gian ra</span>

              <strong>
                {{ formatDate(receipt.checkOutAt) }}
              </strong>
            </div>

            <div>
              <span>Thời gian gửi thực tế</span>

              <strong>
                {{ duration(receipt.parkedMinutes) }}
              </strong>
            </div>

            <div>
              <span>Số giờ tính phí</span>

              <strong>
                {{ receipt.billableHours }} giờ
              </strong>
            </div>

          </div>


          <!-- CHI TIẾT CHI PHÍ -->

          <div class="receipt-pricing">

            <div>
              <span>
                Phí gửi xe
                <small>5.000đ/giờ</small>
              </span>

              <strong>
                {{ money(receipt.parkingFee) }}
              </strong>
            </div>

            <div>
              <span>
                Phạt qua đêm
                <small>
                  {{ receipt.violationNights }}
                  đêm vi phạm
                </small>
              </span>

              <strong
                [class.penalty]="receipt.penaltyFee > 0"
              >
                {{ money(receipt.penaltyFee) }}
              </strong>
            </div>

          </div>


          <!-- TỔNG THANH TOÁN -->

          <div class="receipt-total">

            <span>Tổng thanh toán</span>

            <strong>
              {{ money(receipt.totalFee) }}
            </strong>

          </div>


          <!-- GHI CHÚ -->

          <div class="receipt-note">
            Hóa đơn đã được chốt tại thời điểm
            xe ra bãi. Thay đổi đồng hồ mô phỏng
            sẽ không làm thay đổi hóa đơn này.
          </div>


          <!-- ĐÓNG HÓA ĐƠN -->

          <button
            class="receipt-close"
            type="button"
            (click)="closeReceipt(receipt)"
          >
            Đã hiểu · Đóng hóa đơn
          </button>

        </section>

      </div>

    }

  `,

  styles: [`

    :host {
      font-family: inherit;
    }

    /* LỚP NỀN POPUP */

    .receipt-overlay {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding: 12px 12px 0;
      box-sizing: border-box;
      background: var(--backdrop);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
    }

    /* KHUNG HÓA ĐƠN */

    .receipt-modal {
      width: 100%;
      max-width: 430px;
      max-height: calc(100dvh - 20px);
      overflow-y: auto;
      padding: 16px 20px calc(22px + env(safe-area-inset-bottom));
      box-sizing: border-box;
      border-top: 3px solid var(--signal);
      border-radius: var(--radius-lg) var(--radius-lg) 0 0;
      background: var(--paper);
      box-shadow: var(--shadow-modal);
    }

    .receipt-handle {
      width: 40px;
      height: 4px;
      margin: 0 auto 16px;
      border-radius: var(--radius-pill);
      background: var(--line);
    }

    /* HEADER */

    .receipt-heading {
      text-align: center;
    }

    .receipt-icon {
      display: inline-grid;
      place-items: center;
      width: 48px;
      height: 48px;
      border-radius: var(--radius-md);
      background: var(--surface-dark);
      color: var(--signal);
    }

    .receipt-success {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      margin-top: 10px;
      color: var(--status-free);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.06em;
    }

    .receipt-heading h2 {
      margin: 8px 0 4px;
      color: var(--ink);
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.03em;
    }

    .receipt-heading p {
      margin: 0;
      color: var(--muted);
      font-size: 13px;
    }

    /* THÔNG TIN XE */

    .receipt-vehicle {
      display: flex;
      flex-direction: column;
      gap: 5px;
      margin: 18px 0;
      padding: 15px;
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      background: var(--cream);
      text-align: center;
    }

    .receipt-vehicle span {
      color: var(--muted);
      font-size: 12px;
      font-weight: 600;
    }

    .receipt-vehicle strong {
      color: var(--ink);
      font-family: var(--font-mono);
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 0.05em;
    }

    .receipt-vehicle small {
      color: var(--forest);
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 700;
    }

    /* CHI TIẾT */

    .receipt-details,
    .receipt-pricing {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 14px 0;
      border-bottom: 1px dashed var(--line);
    }

    .receipt-details > div,
    .receipt-pricing > div {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .receipt-details span,
    .receipt-pricing span {
      color: var(--muted);
      font-size: 13px;
    }

    .receipt-details strong,
    .receipt-pricing strong {
      color: var(--ink);
      font-size: 13px;
      font-weight: 750;
      font-variant-numeric: tabular-nums;
      text-align: right;
    }

    .receipt-pricing strong {
      font-family: var(--font-mono);
    }

    .receipt-pricing small {
      display: block;
      margin-top: 3px;
      color: var(--muted);
      font-size: 12px;
    }

    .receipt-pricing .penalty {
      color: var(--status-danger);
    }

    /* TỔNG TIỀN */

    .receipt-total {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-top: 16px;
      padding: 16px;
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      background: var(--surface-dark);
    }

    .receipt-total span {
      color: #cfd6d9;
      font-size: 13px;
      font-weight: 700;
    }

    .receipt-total strong {
      color: var(--signal);
      font-family: var(--font-mono);
      font-size: 21px;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
    }

    /* GHI CHÚ */

    .receipt-note {
      margin-top: 14px;
      padding: 10px 12px;
      border-radius: var(--radius-sm);
      background: var(--status-free-bg);
      color: var(--status-free);
      font-size: 12px;
      line-height: 1.5;
      text-align: center;
    }

    /* NÚT ĐÓNG */

    .receipt-close {
      width: 100%;
      min-height: 48px;
      margin-top: 16px;
      border: 0;
      border-radius: var(--radius-sm);
      background: var(--surface-dark);
      color: var(--paper);
      font-size: 14px;
      font-weight: 800;
      cursor: pointer;
    }

    .receipt-close:hover {
      background: var(--surface-dark-2);
    }

    .receipt-close:active {
      transform: scale(0.985);
    }

  `]
})
export class ParkingReceiptNotice {

  // =====================================
  // SERVICES
  // =====================================

  private readonly router = inject(Router);

  private readonly receiptStore =
    inject(ParkingReceiptService);

  private readonly demoUsers =
    inject(DemoUserService);


  // =====================================
  // URL HIỆN TẠI
  // =====================================

  readonly currentUrl = signal(
    this.router.url
  );


  // =====================================
  // XÁC ĐỊNH VAI TRÒ
  // =====================================

  readonly role = computed<ReceiptRole | null>(() => {

    const url = this.currentUrl();

    if (url.startsWith('/operator')) {
      return 'operator';
    }

    if (url.startsWith('/customer')) {
      return 'customer';
    }

    return null;
  });


  // =====================================
  // LẤY HÓA ĐƠN CHƯA XEM
  // =====================================

  readonly currentReceipt =
    computed<ParkingReceipt | null>(() => {

      const role = this.role();

      // NGƯỜI ĐIỀU HÀNH:
      // Hiển thị hóa đơn chưa xem của toàn hệ thống.

      if (role === 'operator') {

        return this.receiptStore
          .unseenReceipts('operator')[0] ?? null;

      }

      // NGƯỜI DÙNG:
      // Tự nhận diện biển số theo tài khoản demo.

      if (role === 'customer') {

        const plate =
          this.demoUsers.activePlate();

        if (!plate) {
          return null;
        }

        return this.receiptStore
          .unseenReceipts('customer', plate)[0] ?? null;

      }

      return null;

    });


  // =====================================
  // THEO DÕI ĐIỀU HƯỚNG
  // =====================================

  constructor() {

    this.router.events
      .pipe(takeUntilDestroyed())
      .subscribe(event => {

        if (event instanceof NavigationEnd) {

          this.currentUrl.set(
            event.urlAfterRedirects
          );

        }

      });

  }


  // =====================================
  // ĐÓNG HÓA ĐƠN
  // =====================================

  @HostListener('document:keydown.escape')
  onEscape(): void {
    const receipt = this.currentReceipt();
    if (receipt) {
      this.closeReceipt(receipt);
    }
  }

  closeReceipt(receipt: ParkingReceipt): void {

    const role = this.role();

    if (!role) {
      return;
    }

    this.receiptStore.markSeen(
      receipt.receiptId,
      role
    );

  }


  // =====================================
  // ĐỊNH DẠNG TIỀN
  // =====================================

  money(amount: number): string {

    return new Intl.NumberFormat('vi-VN')
      .format(amount) + 'đ';

  }


  // =====================================
  // ĐỊNH DẠNG NGÀY GIỜ
  // =====================================

  formatDate(value: string | null): string {

    if (!value) {
      return '—';
    }

    const date = new Date(value);

    if (!Number.isFinite(date.getTime())) {
      return '—';
    }

    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

  }


  // =====================================
  // ĐỊNH DẠNG THỜI GIAN GỬI XE
  // =====================================

  duration(minutes: number): string {

    const hours = Math.floor(minutes / 60);

    const remaining = minutes % 60;

    return `${hours} giờ ${remaining} phút`;

  }

}
