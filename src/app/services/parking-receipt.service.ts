import {
  Injectable,
  signal
} from '@angular/core';

import type {
  ParkingFeeRecord
} from './parking-fee.service';

export interface ParkingReceipt extends ParkingFeeRecord {

  receiptId: string;

  finalizedAt: string;

  // Chuẩn bị cho thông báo hai vai trò
  operatorSeen: boolean;

  customerSeen: boolean;
}

export type ReceiptRole =
  | 'operator'
  | 'customer';

const STORAGE_KEY = 'smart-parking-receipts-v1';

@Injectable({
  providedIn: 'root'
})
export class ParkingReceiptService {

  readonly receipts = signal<ParkingReceipt[]>(
    this.load()
  );


  // =====================================
  // CHỐT VÀ LƯU HÓA ĐƠN
  // =====================================

  saveFromBill(
    bill: ParkingFeeRecord
  ): ParkingReceipt | null {

    // Chỉ chốt khi xe thực sự check-out
    if (!bill.completed || !bill.checkOutAt) {
      return null;
    }

    // Một lượt xe chỉ có một hóa đơn
    const existing = this.receipts().find(
      item => item.sessionId === bill.sessionId
    );

    if (existing) {
      return existing;
    }

    // Sao chép số tiền tại thời điểm check-out
    const receipt: ParkingReceipt = {
      ...bill,

      receiptId: `receipt-${bill.sessionId}`,

      finalizedAt: bill.checkOutAt,

      operatorSeen: false,

      customerSeen: false
    };

    this.receipts.update(current => [
      receipt,
      ...current
    ]);

    this.save();

    return receipt;
  }


  // =====================================
  // ĐÁNH DẤU ĐÃ XEM THÔNG BÁO
  // =====================================

  markSeen(
    receiptId: string,
    role: ReceiptRole
  ): void {

    this.receipts.update(current =>
      current.map(receipt => {

        if (receipt.receiptId !== receiptId) {
          return receipt;
        }

        return role === 'operator'
          ? {
              ...receipt,
              operatorSeen: true
            }
          : {
              ...receipt,
              customerSeen: true
            };
      })
    );

    this.save();
  }


  // =====================================
  // LẤY HÓA ĐƠN CHƯA XEM
  // =====================================

  unseenReceipts(
    role: ReceiptRole,
    plate?: string
  ): ParkingReceipt[] {

    const normalizedPlate = plate
      ? this.normalizePlate(plate)
      : null;

    return this.receipts().filter(receipt => {

      const unseen = role === 'operator'
        ? !receipt.operatorSeen
        : !receipt.customerSeen;

      const matchesPlate =
        normalizedPlate === null ||
        this.normalizePlate(receipt.plate) ===
          normalizedPlate;

      return unseen && matchesPlate;
    });
  }


  // =====================================
  // CHUẨN HÓA BIỂN SỐ
  // =====================================

  private normalizePlate(value: string): string {

    return value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
  }


  // =====================================
  // LƯU LOCALSTORAGE
  // =====================================

  private save(): void {

    try {

      if (typeof localStorage === 'undefined') {
        return;
      }

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(this.receipts())
      );

    } catch (error) {

      console.error(
        'Không thể lưu hóa đơn:',
        error
      );
    }
  }


  // =====================================
  // ĐỌC LOCALSTORAGE
  // =====================================

  private load(): ParkingReceipt[] {

    try {

      if (typeof localStorage === 'undefined') {
        return [];
      }

      const stored = localStorage.getItem(
        STORAGE_KEY
      );

      if (!stored) {
        return [];
      }

      const parsed: unknown = JSON.parse(stored);

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.filter(
        (item): item is ParkingReceipt => {

          if (
            typeof item !== 'object' ||
            item === null
          ) {
            return false;
          }

          const receipt = item as Record<string, unknown>;

          return (
            typeof receipt['receiptId'] === 'string' &&
            typeof receipt['sessionId'] === 'string' &&
            typeof receipt['plate'] === 'string' &&
            typeof receipt['checkOutAt'] === 'string' &&
            typeof receipt['finalizedAt'] === 'string' &&

            typeof receipt['parkingFee'] === 'number' &&
            typeof receipt['penaltyFee'] === 'number' &&
            typeof receipt['totalFee'] === 'number' &&

            Number.isFinite(receipt['parkingFee']) &&
            Number.isFinite(receipt['penaltyFee']) &&
            Number.isFinite(receipt['totalFee']) &&

            typeof receipt['operatorSeen'] === 'boolean' &&
            typeof receipt['customerSeen'] === 'boolean'
          );
        }
      );

    } catch {

      return [];
    }
  }

}