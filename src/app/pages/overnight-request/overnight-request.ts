
import {
  Component,
  inject,
  signal
} from '@angular/core';

import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

import {
  ParkingSessionService
} from '../../services/parking-session.service';

import {
  OvernightRequestService
} from '../../services/overnight-request.service';

import {
  DemoUserService
} from '../../services/demo-user.service';

import {
  firstOvernightWindow
} from '../../services/overnight-window.util';

@Component({
  selector: 'app-overnight-request',

  standalone: true,

  imports: [
    RouterLink,
    FormsModule,
    DatePipe
  ],

  templateUrl: './overnight-request.html',

  styleUrl: './overnight-request.scss',

  styles: [`

    .overnight-account-note {
      margin: 8px 0 0;
      font-size: 12px;
      color: var(--forest);
      font-weight: 700;
    }

    .overnight-stats {
      display: grid;
      grid-template-columns:
        repeat(4, minmax(0, 1fr));
      gap: 7px;
      margin: 20px 0 26px;
    }

    .overnight-stat {
      min-width: 0;
      padding: 14px 4px;
      text-align: center;
      border-radius: 13px;
      background: var(--paper);
      border: 1px solid var(--line);
    }

    .overnight-stat span {
      display: block;
      margin-bottom: 8px;
      font-size: 10px;
      color: var(--muted);
    }

    .overnight-stat strong {
      display: block;
      font-size: 23px;
      color: var(--ink);
    }

    .overnight-stat.pending strong {
      color: #df9513;
    }

    .overnight-stat.approved strong {
      color: #18a462;
    }

    .overnight-stat.rejected strong {
      color: #e15459;
    }

    .overnight-stat.cancelled strong {
      color: var(--muted);
    }

    .overnight-status.cancelled-status {
      color: var(--muted);
      background: var(--cream);
    }

    .history-message.cancelled-message {
      color: var(--muted);
      background: var(--cream);
    }

    .overnight-cancel-button {
      display: block;
      width: 100%;
      padding: 13px;
      margin-top: 14px;
      border: 1px solid #fecaca;
      border-radius: 12px;
      background: #fff4f4;
      color: #dc4545;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }

    /* THÔNG TIN XE CỐ ĐỊNH */

    .vehicle-information {
      padding: 15px;
      margin: 15px 0 20px;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: var(--cream);
    }

    .vehicle-detail {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid var(--line);
      font-size: 12px;
    }

    .vehicle-detail:first-child {
      padding-top: 0;
    }

    .vehicle-detail:last-child {
      padding-bottom: 0;
      border-bottom: none;
    }

    .vehicle-detail span {
      color: var(--muted);
    }

    .vehicle-detail strong {
      color: var(--muted);
      text-align: right;
    }

    .vehicle-detail strong.parked {
      color: #18a462;
    }

    .vehicle-detail strong.not-parked {
      color: var(--muted);
    }

    /* BIỂN SỐ CỐ ĐỊNH */

    .fixed-vehicle-plate {
      font-size: 14px;
      letter-spacing: .5px;
      font-weight: 800;
    }

    /* KHÔNG CÓ XE TRONG BÃI */

    .no-active-vehicle {
      padding: 16px;
      margin: 14px 0;
      border: 1px solid #f1dbad;
      border-radius: 13px;
      background: #fff6e4;
      color: #b48428;
    }

    .no-active-vehicle strong {
      display: block;
      margin-bottom: 8px;
      font-size: 13px;
    }

    .no-active-vehicle p {
      margin: 0;
      font-size: 12px;
      line-height: 1.7;
    }

    .no-active-vehicle a {
      display: inline-block;
      margin-top: 10px;
      color: var(--forest);
      font-size: 12px;
      font-weight: 700;
      text-decoration: none;
    }

    /* KHUNG THỜI GIAN QUA ĐÊM */

    .night-window {
      display: flex;
      flex-direction: column;
      gap: 7px;
      padding: 14px;
      margin: 12px 0 17px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--cream);
    }

    .night-window span {
      color: var(--muted);
      font-size: 11px;
    }

    .night-window strong {
      color: var(--forest);
      font-size: 13px;
    }

    .night-price-note {
      margin: 14px 0;
      font-size: 12px;
      line-height: 1.6;
      color: var(--muted);
    }

    .linked-booking-note {
      margin-top: 10px;
      color: var(--forest);
      font-size: 11px;
      line-height: 1.6;
    }

  `]
})
export class OvernightRequestPage {

  // =====================================
  // SERVICES
  // =====================================

  readonly overnight = inject(
    OvernightRequestService
  );

  readonly demoUsers = inject(
    DemoUserService
  );

  private readonly parkingSessions = inject(
    ParkingSessionService
  );

  // =====================================
  // XE ĐANG GỬI CỦA USER HIỆN TẠI
  // =====================================

  readonly activeSession =
    this.parkingSessions.myActiveSession;

  get plate(): string {

    return this.demoUsers.activePlate();

  }

  get vehicleLocated(): boolean {

    return this.activeSession() !== null;

  }

  get floor(): string {

    return this.activeSession()?.floor ?? '';

  }

  get spot(): string {

    return this.activeSession()?.spot ?? '';

  }

  // =====================================
  // THÔNG TIN YÊU CẦU
  // =====================================

  nightDate = '';

  reason = '';

  get minNightDate(): string {

    const session = this.activeSession();

    if (!session) {
      return '';
    }

    return firstOvernightWindow(
      session.checkInAt
    )?.nightDate ?? '';

  }

  // =====================================
  // HIỂN THỊ KHUNG GIỜ QUA ĐÊM
  // =====================================

  get overnightWindow() {

    if (!this.nightDate) {
      return null;
    }

    return firstOvernightWindow(
      `${this.nightDate}T12:00:00`
    );

  }

  get validNightDate(): boolean {

    return (
      !!this.activeSession() &&
      !!this.nightDate &&
      !!this.overnightWindow &&
      this.nightDate >= this.minNightDate
    );

  }

  // =====================================
  // THÔNG BÁO
  // =====================================

  readonly message = signal('');

  readonly success = signal(false);

  // =====================================
  // GỬI YÊU CẦU
  // =====================================

  submit(): void {

    const session = this.activeSession();

    if (!session) {

      this.success.set(false);

      this.message.set(
        'Bạn chưa có xe trong bãi.'
      );

      return;

    }

    if (!this.validNightDate) {

      this.success.set(false);

      this.message.set(
        'Vui lòng chọn ngày qua đêm hợp lệ.'
      );

      return;

    }

    if (!this.reason.trim()) {

      this.success.set(false);

      this.message.set(
        'Vui lòng nhập lý do gửi xe qua đêm.'
      );

      return;

    }

    const result = this.overnight.createRequest({

      plate: this.plate,

      floor: session.floor,

      spot: session.spot,

      nightDate: this.nightDate,

      reason: this.reason.trim()

    });

    this.message.set(result.message);

    this.success.set(result.ok);

    if (result.ok) {

      this.reason = '';

      this.nightDate = '';

    }

  }

  // =====================================
  // HỦY YÊU CẦU
  // =====================================

  cancelRequest(id: string): void {

    const result =
      this.overnight.cancelRequest(id);

    this.success.set(result.ok);

    this.message.set(result.message);

  }

}
