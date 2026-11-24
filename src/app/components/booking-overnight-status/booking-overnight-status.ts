
import {
  Component,
  Input,
  inject
} from '@angular/core';

import {
  type ParkingBookingRequest
} from '../../services/booking-request.service';

import {
  OvernightRequestService,
  type OvernightStatus
} from '../../services/overnight-request.service';

@Component({
  selector: 'app-booking-overnight-status',

  standalone: true,

  template: `

    @if (requests.length > 0) {

      <section class="overnight-status-box">

        <h3>
          🌙 Yêu cầu gửi xe qua đêm
        </h3>

        @for (request of requests; track request.id) {

          <div class="night-record">

            <div class="night-header">

              <strong>
                Đêm {{ request.nightDate }}
              </strong>

              <span

                class="night-status"

                [class.pending]="
                  request.status === 'pending'
                "

                [class.approved]="
                  request.status === 'approved'
                "

                [class.rejected]="
                  request.status === 'rejected'
                "

                [class.cancelled]="
                  request.status === 'cancelled'
                "
              >

                {{ statusLabel(request.status) }}

              </span>

            </div>

            <p class="night-reason">
              Lý do: {{ request.reason }}
            </p>

          </div>

        }

      </section>

    }

  `,

  styles: [`

    .overnight-status-box {
      padding: 14px;
      margin-top: 14px;
      border: 1px solid #e5dcfa;
      border-radius: 13px;
      background: #f8f4ff;
    }

    h3 {
      margin: 0 0 13px;
      color: #805acb;
      font-size: 13px;
      font-weight: 700;
    }

    .night-record {
      padding-top: 12px;
      margin-top: 12px;
      border-top: 1px solid #e6dff2;
    }

    .night-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      font-size: 12px;
    }

    .night-status {
      padding: 6px 9px;
      border-radius: 20px;
      font-size: 10px;
      font-weight: 700;
    }

    .pending {
      background: #fff2da;
      color: #d59a22;
    }

    .approved {
      background: #dff5e7;
      color: #219e59;
    }

    .rejected {
      background: #ffeaed;
      color: #de535e;
    }

    .cancelled {
      background: #edf0f5;
      color: #8390a4;
    }

    .night-reason {
      margin: 10px 0 0;
      color: #8a809f;
      font-size: 11px;
      line-height: 1.6;
      overflow-wrap: anywhere;
    }

  `]
})
export class BookingOvernightStatus {

  @Input({ required: true })
  booking!: ParkingBookingRequest;

  private readonly overnight = inject(
    OvernightRequestService
  );

  get requests() {

    return this.overnight.forBooking(
      this.booking
    );

  }

  statusLabel(status: OvernightStatus): string {

    switch (status) {

      case 'pending':
        return 'Chờ duyệt';

      case 'approved':
        return 'Đã duyệt';

      case 'rejected':
        return 'Từ chối';

      case 'cancelled':
        return 'Đã hủy';

    }

  }

}
