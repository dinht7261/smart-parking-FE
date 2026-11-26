import { RouterLink } from '@angular/router';

import {
  BookingRequestService
} from '../../services/booking-request.service';

import {
  Component,
  computed,
  inject,
  signal,
  OnInit
} from '@angular/core';

@Component({
  selector: 'app-operator-requests',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './operator-requests.html',
  styleUrl: './operator-requests.scss'
})
export class OperatorRequests implements OnInit {

  readonly bookings = inject(BookingRequestService);

  readonly feedback = signal('');

  readonly feedbackError = signal(false);


  ngOnInit(): void {

  void this.bookings.refreshAll().then(result => {

    if (!result.ok) {
      this.feedback.set(result.message);
      this.feedbackError.set(true);
    }

  });

}

async approve(id: string): Promise<void> {

  const result = await this.bookings.approveRequest(id);

  this.feedback.set(result.message);

  this.feedbackError.set(!result.ok);

}

async reject(id: string): Promise<void> {

  const result = await this.bookings.rejectRequest(id);

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