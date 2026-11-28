import {
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';

import {
  overnightDatesInRange
} from '../../services/overnight-window.util';

import { AppIcon } from '../app-icon/app-icon';

@Component({
  selector: 'app-booking-overnight-section',
  standalone: true,
  imports: [AppIcon],

  template: `

    @if (nightDates.length > 0) {

      <section class="night-request">

        <div class="night-title">
          <app-icon name="moon" [size]="16" />
          <span>Yêu cầu gửi xe qua đêm</span>
        </div>

        <p>
          Thời gian đặt chỗ của bạn giao với
          khung giờ 22:00–06:00.

          Vui lòng nhập lý do để gửi kèm
          yêu cầu xin phép qua đêm.
        </p>

        <div class="night-list">

          @for (date of nightDates; track date) {

            <span class="night-chip">
              Đêm {{ date }}
            </span>

          }

        </div>

        <label for="bookingOvernightReason">
          Lý do gửi xe qua đêm *
        </label>

        <textarea
          id="bookingOvernightReason"
          rows="3"
          maxlength="500"
          [value]="reason"
          [attr.aria-invalid]="!reason.trim()"
          [attr.aria-describedby]="!reason.trim() ? 'bookingOvernightReasonError' : null"
          (input)="updateReason($event)"
          placeholder="Nhập lý do gửi xe qua đêm..."
        ></textarea>

        @if (!reason.trim()) {

          <div
            id="bookingOvernightReasonError"
            class="validation"
            role="alert"
          >
            Vui lòng nhập lý do gửi xe qua đêm.
          </div>

        }

        <p class="night-footer">
          Đặt chỗ và gửi xe qua đêm
          sẽ được người điều hành xét duyệt riêng.
        </p>

      </section>

    }

  `,

  styles: [`

    .night-request {
      box-sizing: border-box;
      padding: 16px;
      margin: 18px 0;
      border: 1px solid var(--status-maint-border);
      border-radius: var(--radius-md);
      background: var(--status-maint-bg);
      color: var(--ink);
    }

    .night-title {
      display: flex;
      align-items: center;
      gap: 7px;
      color: var(--status-maint);
      font-size: 15px;
      font-weight: 800;
    }

    .night-request p {
      margin: 10px 0;
      font-size: 13px;
      line-height: 1.55;
    }

    .night-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 12px 0 16px;
    }

    .night-chip {
      padding: 6px 10px;
      border: 1px solid var(--status-maint-border);
      border-radius: var(--radius-sm);
      background: var(--paper);
      color: var(--status-maint);
      font-size: 12px;
      font-weight: 750;
    }

    label {
      display: block;
      margin-bottom: 8px;
      font-size: 13px;
      font-weight: 700;
    }

    textarea {
      width: 100%;
      box-sizing: border-box;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      background: var(--paper);
      color: var(--ink);
      font: inherit;
      font-size: 14px;
      resize: vertical;
    }

    textarea:focus {
      outline: none;
      border-color: var(--focus);
      box-shadow: 0 0 0 3px rgba(168, 64, 9, 0.14);
    }

    .validation {
      margin-top: 8px;
      color: var(--status-danger);
      font-size: 12px;
      font-weight: 600;
    }

    .night-footer {
      color: var(--muted);
      font-size: 12px;
    }

  `]
})
export class BookingOvernightSection {

  @Input() from = '';
  @Input() to = '';
  @Input() reason = '';

  @Output()
  reasonChange = new EventEmitter<string>();

  get nightDates(): string[] {

    return overnightDatesInRange(
      this.from,
      this.to
    );
  }

  updateReason(event: Event): void {

    const target =
      event.target as HTMLTextAreaElement;

    this.reasonChange.emit(
      target.value
    );
  }
}
