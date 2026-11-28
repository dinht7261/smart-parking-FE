import {
  Component,
  inject,
  signal
} from '@angular/core';

import { RouterLink } from '@angular/router';

import {
  SimulationClockService
} from '../../services/simulation-clock.service';

import { AppIcon } from '../../components/app-icon/app-icon';

@Component({
  selector: 'app-simulation-clock',
  standalone: true,
  imports: [RouterLink, AppIcon],
  templateUrl: './simulation-clock.html',
  styleUrl: './simulation-clock.scss'
})
export class SimulationClock {

  readonly clock = inject(SimulationClockService);

  // Giá trị trong ô chọn ngày giờ
  readonly selectedDateTime = signal(
    this.clock.toInputValue(this.clock.now())
  );

  readonly feedback = signal('');

  // Áp dụng ngày giờ do người dùng chọn
  applyTime(): void {

    const ok = this.clock.setSimulatedTime(
      this.selectedDateTime()
    );

    this.feedback.set(
      ok
        ? 'Đã áp dụng thời gian mô phỏng.'
        : 'Ngày giờ không hợp lệ. Vui lòng chọn lại.'
    );
  }

  // Chọn nhanh một mốc thời gian
  choosePreset(hour: number, minute: number): void {

    this.clock.setPreset(hour, minute);

    this.selectedDateTime.set(
      this.clock.toInputValue(this.clock.now())
    );

    this.feedback.set(
      'Đã chuyển đến thời gian mô phỏng được chọn.'
    );
  }

  // Trở về giờ thực
  useRealTime(): void {

    this.clock.useRealTime();

    this.selectedDateTime.set(
      this.clock.toInputValue(this.clock.now())
    );

    this.feedback.set(
      'Đã quay về thời gian thực.'
    );
  }

  // Hiển thị ngày giờ
  formatTime(date: Date): string {

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