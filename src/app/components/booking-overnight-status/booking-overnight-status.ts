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

import { AppIcon } from '../app-icon/app-icon';

@Component({
  selector: 'app-booking-overnight-status',
  standalone: true,
  imports: [AppIcon],

  template: `

    @if (requests.length > 0) {

      <section class="overnight-status-box">

        <h3>
          <app-icon name="moon" [size]="15" />
          <span>Yêu cầu gửi xe qua đêm</span>
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
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      background: var(--cream);
    }

    h3 {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0 0 12px;
      color: var(--forest);
      font-size: 13px;
      font-weight: 800;
    }

    .night-record {
      padding-top: 12px;
      margin-top: 12px;
      border-top: 1px solid var(--line);
    }

    .night-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      font-size: 13px;
    }

    .night-status {
      padding: 5px 10px;
      border: 1px solid transparent;
      border-radius: var(--radius-pill);
      font-size: 12px;
      font-weight: 750;
    }

    .pending {
      background: var(--status-maint-bg);
      border-color: var(--status-maint-border);
      color: var(--status-maint);
    }

    .approved {
      background: var(--status-free-bg);
      border-color: var(--status-free-border);
      color: var(--status-free);
    }

    .rejected {
      background: var(--status-danger-bg);
      border-color: var(--status-danger-border);
      color: var(--status-danger);
    }

    .cancelled {
      background: var(--sand);
      border-color: var(--line);
      color: var(--muted);
    }

    .night-reason {
      margin: 8px 0 0;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.55;
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
