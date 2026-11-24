import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BookingRequestService } from '../../services/booking-request.service';

import {
  BookingOvernightStatus
} from '../../components/booking-overnight-status/booking-overnight-status';

@Component({
  selector: 'app-customer-requests',
  standalone: true,
  imports: [RouterLink, BookingOvernightStatus],
  templateUrl: './customer-requests.html',
  styleUrl: './customer-requests.scss'
})
export class CustomerRequests {

  // Service quản lý các yêu cầu
  readonly bookings = inject(BookingRequestService);

  // Lưu ID yêu cầu đang xác nhận hủy
  readonly confirmingCancelId = signal<string | null>(null);

  // Thông báo kết quả
  readonly feedback = signal('');

  // Kiểm tra thông báo lỗi
  readonly feedbackError = signal(false);


  // Bấm nút Hủy yêu cầu
  askCancel(id: string): void {
    this.confirmingCancelId.set(id);
    this.feedback.set('');
  }


  // Bấm nút Giữ yêu cầu
  keepRequest(): void {
    this.confirmingCancelId.set(null);
  }


  // Bấm nút Xác nhận hủy
  confirmCancel(id: string): void {

    const result = this.bookings.cancelRequest(id);

    this.feedback.set(result.message);

    this.feedbackError.set(!result.ok);

    this.confirmingCancelId.set(null);
  }


  // Hiển thị thời gian theo định dạng Việt Nam
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