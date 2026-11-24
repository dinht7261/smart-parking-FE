import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  OvernightRequestService
} from '../../services/overnight-request.service';

@Component({
  selector: 'app-operator-overnight',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './operator-overnight.html',
  styleUrl: './operator-overnight.scss'
})
export class OperatorOvernight {

  readonly overnight = inject(OvernightRequestService);

  readonly feedback = signal('');
  readonly feedbackError = signal(false);

  // Chấp nhận yêu cầu
  approve(id: string): void {
    const result = this.overnight.approveRequest(id);

    this.feedback.set(result.message);
    this.feedbackError.set(!result.ok);
  }

  // Từ chối yêu cầu
  reject(id: string): void {
    const result = this.overnight.rejectRequest(id);

    this.feedback.set(result.message);
    this.feedbackError.set(!result.ok);
  }

  // Định dạng ngày gửi
  formatDate(value: string): string {
    const parts = value.split('-');

    if (parts.length !== 3) {
      return value;
    }

    const [year, month, day] = parts;

    return `${day}/${month}/${year}`;
  }

  // Định dạng thời gian tạo yêu cầu
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