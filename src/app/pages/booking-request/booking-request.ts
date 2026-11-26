
import {
  Component,
  inject,
  signal
} from '@angular/core';

import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  ActivatedRoute,
  RouterLink
} from '@angular/router';

import {
  ParkingLotService,
  type FloorId,
  type ParkingSpot
} from '../../services/parking-lot.service';

import {
  BookingRequestService
} from '../../services/booking-request.service';

import {
  DemoUserService
} from '../../services/demo-user.service';

import {
  firstOvernightWindow
} from '../../services/overnight-window.util';

@Component({
  selector: 'app-booking-request',
  standalone: true,

  imports: [
    RouterLink,
    FormsModule,
    DatePipe
  ],

  templateUrl: './booking-request.html',
  styleUrl: './booking-request.scss'
})
export class BookingRequest {

  private readonly route = inject(
    ActivatedRoute
  );

  private readonly bookingService = inject(
    BookingRequestService
  );

  private readonly lot = inject(
    ParkingLotService
  );

  readonly users = inject(
    DemoUserService
  );

  readonly submitting = signal(false);
  // =====================================
  // VỊ TRÍ ĐỖ XE
  // =====================================

  readonly floor =
    this.route.snapshot.queryParamMap
      .get('floor') ?? 'B1';

  readonly spot =
    this.route.snapshot.queryParamMap
      .get('spot') ?? 'A01';

  // =====================================
  // THỜI GIAN DỰ KIẾN GỬI XE
  // =====================================

  startDate = '';

  startTime = '';

  // =====================================
  // YÊU CẦU QUA ĐÊM
  // =====================================

  requestOvernight = false;

  overnightReason = '';

  // =====================================
  // BIỂN SỐ CỐ ĐỊNH
  // =====================================

  get licensePlate(): string {

    return this.users.activePlate();

  }

  get from(): string {

    if (!this.startDate || !this.startTime) {
      return '';
    }

    return `${this.startDate}T${this.startTime}`;

  }

  get today(): string {

    return this.formatDate(new Date());

  }

  // =====================================
  // TỰ XÁC ĐỊNH KHUNG GIỜ QUA ĐÊM
  // =====================================

  get overnightWindow() {

    if (!this.from) {
      return null;
    }

    return firstOvernightWindow(this.from);

  }

  toggleOvernight(checked: boolean): void {

    this.requestOvernight = checked;

    if (!checked) {

      this.overnightReason = '';

    }

  }

  // =====================================
  // THÔNG BÁO
  // =====================================

  readonly notice = signal('');

  readonly submitted = signal(false);

  // =====================================
  // GỬI YÊU CẦU ĐẶT CHỖ
  // =====================================

async submit(): Promise<void> {

  if (this.submitted() || this.submitting()) {
    return;
  }

  this.notice.set('');

  if (
    this.floor !== 'B1' &&
    this.floor !== 'B2'
  ) {
    this.notice.set('Tầng đỗ xe không hợp lệ.');
    return;
  }

  const selectedSpot = this.lot
    .spotsOnFloor(this.floor as FloorId)
    .find(item => item.id === this.spot);

  if (!selectedSpot) {
    this.notice.set('Vị trí đỗ xe không hợp lệ.');
    return;
  }

  if (!this.from) {
    this.notice.set('Vui lòng chọn ngày giờ gửi xe.');
    return;
  }

  const overnightWindow = this.overnightWindow;

  if (this.requestOvernight) {

    if (
      !overnightWindow ||
      !this.overnightReason.trim()
    ) {
      this.notice.set(
        'Vui lòng chọn thời gian gửi xe và nhập lý do qua đêm.'
      );
      return;
    }

  }

  this.submitting.set(true);

  try {

    const result = await this.bookingService.createRequest({

      floor: this.floor as FloorId,

      spot: this.spot as ParkingSpot['id'],

      from: this.from,

      overnightDate: this.requestOvernight
        ? overnightWindow?.nightDate
        : undefined,

      overnightReason: this.requestOvernight
        ? this.overnightReason.trim()
        : undefined

    });

    this.notice.set(result.message);

    this.submitted.set(result.ok);

  } catch (error) {

    console.error(error);

    this.notice.set(
      'Không thể gửi yêu cầu đặt chỗ.'
    );

  } finally {

    this.submitting.set(false);

  }

}

  // =====================================
  // ĐỊNH DẠNG NGÀY
  // =====================================

  private formatDate(date: Date): string {

    const year = date.getFullYear();

    const month = String(
      date.getMonth() + 1
    ).padStart(2, '0');

    const day = String(
      date.getDate()
    ).padStart(2, '0');

    return `${year}-${month}-${day}`;

  }

}
