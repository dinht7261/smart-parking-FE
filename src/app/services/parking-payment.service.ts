import {
  Injectable,
  inject,
  signal
} from '@angular/core';

import {
  SimulationClockService
} from './simulation-clock.service';

import type {
  ParkingReceipt
} from './parking-receipt.service';

export type PaymentMethod =
  | 'customer-demo'
  | 'operator-cash';

export interface ParkingPayment {
  receiptId: string;
  amount: number;
  method: PaymentMethod;
  paidAt: string;
}

const STORAGE_KEY =
  'smart-parking-demo-payments-v1';

@Injectable({
  providedIn: 'root'
})
export class ParkingPaymentService {

  private readonly clock =
    inject(SimulationClockService);

  readonly payments =
    signal<ParkingPayment[]>(this.load());


  getPayment(
    receiptId: string
  ): ParkingPayment | undefined {

    return this.payments().find(
      payment => payment.receiptId === receiptId
    );
  }


  isPaid(receiptId: string): boolean {

    return this.getPayment(receiptId) !== undefined;
  }


  markPaid(
    receipt: ParkingReceipt,
    method: PaymentMethod
  ): boolean {

    // Không ghi nhận thanh toán hai lần.
    if (this.isPaid(receipt.receiptId)) {
      return false;
    }

    if (
      !Number.isFinite(receipt.totalFee) ||
      receipt.totalFee < 0
    ) {
      return false;
    }

    const payment: ParkingPayment = {

      receiptId: receipt.receiptId,

      amount: receipt.totalFee,

      method,

      paidAt: this.clock.now().toISOString()
    };

    this.payments.update(current => [
      payment,
      ...current
    ]);

    this.persist();

    return true;
  }


  private persist(): void {

    try {

      if (typeof localStorage === 'undefined') {
        return;
      }

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(this.payments())
      );

    } catch {
      // Giữ trạng thái trong bộ nhớ nếu không lưu được.
    }
  }


  private load(): ParkingPayment[] {

    try {

      if (typeof localStorage === 'undefined') {
        return [];
      }

      const stored =
        localStorage.getItem(STORAGE_KEY);

      if (!stored) return [];

      const parsed: unknown =
        JSON.parse(stored);

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.filter(
        (item): item is ParkingPayment => {

          if (
            typeof item !== 'object' ||
            item === null
          ) {
            return false;
          }

          const value =
            item as Record<string, unknown>;

          return (
            typeof value['receiptId'] === 'string' &&
            typeof value['amount'] === 'number' &&
            Number.isFinite(value['amount']) &&
            typeof value['paidAt'] === 'string' &&
            (
              value['method'] === 'customer-demo' ||
              value['method'] === 'operator-cash'
            )
          );
        }
      );

    } catch {

      return [];

    }
  }

}