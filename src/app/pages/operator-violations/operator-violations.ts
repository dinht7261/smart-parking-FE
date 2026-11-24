
import {
  Component,
  computed,
  inject
} from '@angular/core';

import { RouterLink } from '@angular/router';

import {
  ViolationService
} from '../../services/violation.service';

@Component({
  selector: 'app-operator-violations',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './operator-violations.html',
  styleUrl: './operator-violations.scss'
})
export class OperatorViolations {

  // =====================================
  // SERVICE
  // =====================================

  readonly violations = inject(ViolationService);

  // =====================================
  // CHỈ LẤY CÁC PHIÊN CÓ VI PHẠM
  // =====================================

  readonly visibleRecords = computed(() => {

    return this.violations.overtimeRecords()

      .filter(item => item.isViolation)

      .sort((a, b) =>
        new Date(b.evaluatedAt).getTime() -
        new Date(a.evaluatedAt).getTime()
      );

  });

  // =====================================
  // THỐNG KÊ XE VI PHẠM
  // =====================================

  readonly activeViolationCount = computed(() =>

    this.visibleRecords().filter(
      item => item.isActive
    ).length

  );

  readonly completedViolationCount = computed(() =>

    this.visibleRecords().filter(
      item => !item.isActive
    ).length

  );

  // =====================================
  // ĐỊNH DẠNG THỜI GIAN
  // =====================================

  formatTime(
    value: string | Date | null
  ): string {

    if (!value) {
      return '—';
    }

    const date = value instanceof Date
      ? value
      : new Date(value);

    if (Number.isNaN(date.getTime())) {
      return 'Không xác định';
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
