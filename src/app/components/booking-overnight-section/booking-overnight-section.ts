
import {
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';

import {
  overnightDatesInRange
} from '../../services/overnight-window.util';

@Component({
  selector: 'app-booking-overnight-section',
  standalone: true,

  template: `

    @if (nightDates.length > 0) {

      <section class="night-request">

        <div class="night-title">
          🌙 Yêu cầu gửi xe qua đêm
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
          (input)="updateReason($event)"
          placeholder="Nhập lý do gửi xe qua đêm..."
        ></textarea>

        @if (!reason.trim()) {

          <div class="validation">
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
      border: 1px solid #f1d49e;
      border-radius: 15px;
      background: #fff8eb;
      color: var(--ink);
    }

    .night-title {
      color: #b87910;
      font-size: 15px;
      font-weight: 800;
    }

    .night-request p {
      margin: 10px 0;
      font-size: 12px;
      line-height: 1.6;
    }

    .night-list {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin: 12px 0 16px;
    }

    .night-chip {
      padding: 7px 9px;
      border-radius: 9px;
      background: #ffedce;
      color: #9a6812;
      font-size: 11px;
      font-weight: 700;
    }

    label {
      display: block;
      margin-bottom: 8px;
      font-size: 12px;
      font-weight: 700;
    }

    textarea {
      width: 100%;
      box-sizing: border-box;
      padding: 12px;
      border: 1px solid #e8d4b0;
      border-radius: 11px;
      background: var(--paper);
      color: var(--ink);
      font: inherit;
      font-size: 13px;
      resize: vertical;
    }

    .validation {
      margin-top: 8px;
      color: #cf4545;
      font-size: 11px;
    }

    .night-footer {
      color: #936a26;
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
