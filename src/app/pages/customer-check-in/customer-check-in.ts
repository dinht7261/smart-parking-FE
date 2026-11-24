
import {
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
  signal
} from '@angular/core';

import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';

import { BrowserQRCodeReader } from '@zxing/browser';

import { DemoUserService } from '../../services/demo-user.service';

import {
  ParkingSessionService,
  type ParkingSession,
  type ParkingSessionCheckInRequest
} from '../../services/parking-session.service';

import {
  BarrierService
} from '../../services/barrier.service';

@Component({
  selector: 'app-customer-check-in',
  standalone: true,

  imports: [
    RouterLink
  ],

  templateUrl: './customer-check-in.html',
  styleUrl: './customer-check-in.scss'
})
export class CustomerCheckIn implements OnDestroy {

  @ViewChild('cameraVideo')
  private cameraVideo?: ElementRef<HTMLVideoElement>;

  readonly demoUsers = inject(DemoUserService);

  private readonly parkingSessions = inject(
    ParkingSessionService
  );

  private readonly barrier = inject(
  BarrierService
);

  private readonly qrReader = new BrowserQRCodeReader();

  private scannerControls: {
    stop: () => void
  } | null = null;

  // =====================================
  // TRẠNG THÁI GIAO DIỆN
  // =====================================

  readonly isScanning = signal(false);

  readonly isProcessing = signal(false);

  readonly errorMessage = signal('');

  readonly checkedInSession =
    signal<ParkingSession | null>(null);


  // =====================================
  // 1. BẮT ĐẦU QUÉT QR
  // =====================================

  async startScanner(): Promise<void> {

    if (
      this.isScanning() ||
      this.isProcessing() ||
      this.checkedInSession()
    ) {
      return;
    }

    const video = this.cameraVideo?.nativeElement;

    if (!video) {

      this.errorMessage.set(
        'Không tìm thấy camera.'
      );

      return;
    }

    this.errorMessage.set('');

    this.isScanning.set(true);

    try {

      const controls =
        await this.qrReader.decodeFromConstraints(

          {
            audio: false,

            video: {
              facingMode: {
                ideal: 'environment'
              }
            }
          },

          video,

          (result, _error, callbackControls) => {

            if (
              !result ||
              this.isProcessing()
            ) {
              return;
            }

            // Chỉ xử lý một lần
            this.isProcessing.set(true);

            // Dừng camera sau khi đọc được QR
            callbackControls.stop();

            this.scannerControls = null;

            this.isScanning.set(false);

            // Gửi QR lên Backend
            this.submitCheckIn(
              result.getText().trim()
            );

          }

        );

      // Nếu người dùng đã dừng camera trong lúc khởi tạo
      if (this.isScanning()) {

        this.scannerControls = controls;

      } else {

        controls.stop();

      }

    } catch (error) {

      console.error(
        'Camera error:',
        error
      );

      this.isScanning.set(false);

      this.errorMessage.set(
        'Không thể mở camera. Hãy kiểm tra quyền truy cập camera và thử lại.'
      );

    }

  }


  // =====================================
  // 2. DỪNG CAMERA
  // =====================================

  stopScanner(): void {

    this.scannerControls?.stop();

    this.scannerControls = null;

    this.isScanning.set(false);

  }


  // =====================================
  // 3. GỬI CHECK-IN LÊN BACKEND
  // =====================================

private submitCheckIn(
  qrPayload: string
): void {

  const request: ParkingSessionCheckInRequest = {

    qrPayload,

    userCode:
      this.demoUsers.selectedUserId(),

    licensePlate:
      this.demoUsers.activePlate(),

    overnightRequested: false

  };

  this.parkingSessions.checkIn(request).subscribe({

next: session => {

  console.log(
    'Check-in thành công:',
    session
  );

  // Lưu phiên gửi xe
  this.checkedInSession.set(session);

  // =====================================
  // ĐỒNG BỘ THÔNG TIN NHẬN DIỆN KHÁCH
  // =====================================

  this.barrier.openEntryAfterCheckIn({

    userCode: String(
      this.demoUsers.selectedUserId()
    ),

    customerName: session.customerName,

    licensePlate: session.plate,

    sessionCode: session.sessionCode,

    sessionType: session.sessionType

  });

  // Kết thúc xử lý
  this.isProcessing.set(false);

},

    error: (error: HttpErrorResponse) => {

      console.error(
        'Check-in thất bại:',
        error
      );

      this.errorMessage.set(
        this.getErrorMessage(error)
      );

      this.isProcessing.set(false);

    }

  });

}


  // =====================================
  // 4. XỬ LÝ THÔNG BÁO LỖI
  // =====================================

  private getErrorMessage(
    error: HttpErrorResponse
  ): string {

    const body = error.error;

    if (
      typeof body === 'string' &&
      body.trim()
    ) {
      return body;
    }

    if (body && typeof body === 'object') {

      return (
        body.detail ||
        body.message ||
        body.error ||
        'Check-in không thành công.'
      );

    }

    if (error.status === 0) {

      return 'Không thể kết nối Backend. Hãy kiểm tra máy chủ.';

    }

    return `Check-in thất bại (HTTP ${error.status}).`;

  }


  // =====================================
  // 5. NHẬN DIỆN LOẠI KHÁCH
  // =====================================

  get customerTypeLabel(): string {

    const session = this.checkedInSession();

    if (!session) {
      return '';
    }

    return session.sessionType === 'RESERVATION'
      ? 'Khách đã đặt chỗ'
      : 'Khách vãng lai';

  }


  // =====================================
  // 6. HỦY CAMERA KHI RỜI TRANG
  // =====================================

  ngOnDestroy(): void {

    this.stopScanner();

  }

}
