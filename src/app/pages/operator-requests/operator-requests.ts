import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  BookingRequestService
} from '../../services/booking-request.service';

@Component({
  selector: 'app-operator-requests',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './operator-requests.html',
  styleUrl: './operator-requests.scss'
})
export class OperatorRequests {

  readonly bookings = inject(BookingRequestService);

  readonly feedback = signal('');

  readonly feedbackError = signal(false);


  // DUYỆT YÊU CẦU
  approve(id: string): void {

    const result = this.bookings.approveRequest(id);

    this.feedback.set(result.message);

    this.feedbackError.set(!result.ok);

  }


  // TỪ CHỐI YÊU CẦU
  reject(id: string): void {

    const result = this.bookings.rejectRequest(id);

    this.feedback.set(result.message);

    this.feedbackError.set(!result.ok);

  }


  // ĐỊNH DẠNG THỜI GIAN
  formatTime(value: string): string {

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date);

  }

}