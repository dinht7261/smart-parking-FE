import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  BarrierService,
  type GateId,
  type GateState
} from '../../services/barrier.service';

import {
  ParkingAvailabilityPreview
} from '../../components/parking-availability-preview/parking-availability-preview';

@Component({
  selector: 'app-operator-barrier',
  standalone: true,
  imports: [RouterLink, ParkingAvailabilityPreview],
  templateUrl: './operator-barrier.html',
  styleUrl: './operator-barrier.scss'
})
export class OperatorBarrier {

  readonly barrier = inject(BarrierService);

  readonly gates: {
    id: GateId;
    name: string;
    subtitle: string;
  }[] = [
    {
      id: 'entry',
      name: 'Cổng vào',
      subtitle: 'Barrier dành cho xe đi vào'
    },
    {
      id: 'exit',
      name: 'Cổng ra',
      subtitle: 'Barrier dành cho xe đi ra'
    }
  ];

  readonly message = signal('');

  // Thay đổi trạng thái mô phỏng
  changeState(gate: GateId, state: GateState): void {

    const changed = this.barrier.setState(gate, state);

    const name = gate === 'entry' ? 'cổng vào' : 'cổng ra';
    const action = state === 'open' ? 'mở' : 'đóng';

    this.message.set(
      changed
        ? `Đã ${action} barrier ${name} (mô phỏng).`
        : `Barrier ${name} đã ở trạng thái này.`
    );
  }

  // Định dạng thời gian lịch sử
  formatTime(value: string): string {

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date);
  }
}