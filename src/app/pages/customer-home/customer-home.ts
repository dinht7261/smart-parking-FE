
import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal
} from '@angular/core';

import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';

import { BrowserQRCodeReader } from '@zxing/browser';

import {
  EMPTY,
  catchError,
  switchMap,
  timer
} from 'rxjs';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  ParkingSpotsApiService
} from '../../services/parking-spots-api.service';

import type {
  ParkingSpotApiResponse
} from '../../services/parking-spots-api.service';

import {
  DemoUserService,
  type DemoUserId
} from '../../services/demo-user.service';

import {
  ParkingSessionService,
  type ParkingSession,
  type ParkingSessionCheckInRequest
} from '../../services/parking-session.service';

import {
  AppSidebar,
  type SidebarMenuSection
} from '../../components/app-sidebar/app-sidebar';


@Component({
  selector: 'app-customer-home',
  standalone: true,

  imports: [
    RouterLink,
    AppSidebar
  ],

  templateUrl: './customer-home.html',
  styleUrl: './customer-home.scss'
})
export class CustomerHome implements OnInit, OnDestroy {

  // =====================================
  // CAMERA QR
  // =====================================

  @ViewChild('cameraVideo')
  private cameraVideo?: ElementRef<HTMLVideoElement>;

  private readonly qrReader = new BrowserQRCodeReader();

  private scannerControls: {
    stop: () => void
  } | null = null;


  // =====================================
  // KẾT NỐI SERVICE
  // =====================================

  private readonly api = inject(ParkingSpotsApiService);

  private readonly parkingSessions = inject(ParkingSessionService);

  private readonly destroyRef = inject(DestroyRef);

  readonly demoUsers = inject(DemoUserService);


  // =====================================
  // TRẠNG THÁI CUSTOMER HOME
  // =====================================

  readonly showUserChooser = signal(false);

  readonly parkingMapRoute = '/customer/spaces';


  // =====================================
  // TRẠNG THÁI CHECK-IN MODAL
  // =====================================

  readonly showCheckInScanner = signal(false);

  readonly isScanning = signal(false);

  readonly isProcessing = signal(false);

  readonly checkInError = signal('');


  // =====================================
  // THÔNG TIN PHIÊN CHECK-IN
  // =====================================

  readonly checkedInSession =
    signal<ParkingSession | null>(null);

  readonly showSpotNotice = signal(false);


  // =====================================
  // DỮ LIỆU BÃI XE TỪ BACKEND
  // =====================================

  readonly parkingSpots =
    signal<ParkingSpotApiResponse[]>([]);

  readonly parkingLoading = signal(true);

  readonly parkingError = signal('');


  // =====================================
  // THỐNG KÊ CHỖ TRỐNG
  // =====================================

  readonly availableSpaces = computed(() =>
    this.parkingSpots().filter(
      spot => spot.status.toUpperCase() === 'AVAILABLE'
    ).length
  );

  readonly totalSpaces = computed(() =>
    this.parkingSpots().length
  );

  readonly availablePercent = computed(() => {

    const total = this.totalSpaces();

    if (total === 0) {
      return 0;
    }

    return Math.round(
      this.availableSpaces() / total * 100
    );
  });


  // =====================================
  // LOẠI KHÁCH SAU CHECK-IN
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
  // MENU NGƯỜI DÙNG
  // =====================================

  readonly sidebarSections: SidebarMenuSection[] = [

    {
      title: '___________________________________________________',
      items: [
        {
          label: 'Yêu cầu gửi xe qua đêm',
          icon: '🌙',
          path: '/customer/overnight'
        },
        {
          label: 'Yêu cầu của tôi',
          icon: '📋',
          path: '/customer/requests'
        }
      ]
    },

    {
      title: '___________________________________________________',
      items: [
        {
          label: 'Thanh toán & hóa đơn',
          icon: '💳',
          path: '/customer/receipts'
        }
      ]
    }

  ];


  // =====================================
  // KHỞI TẠO VÀ ĐỒNG BỘ BÃI XE
  // =====================================

  ngOnInit(): void {

    timer(0, 5000).pipe(

      switchMap(() =>
        this.api.getSpots().pipe(

          catchError(error => {

            console.error(
              'Không thể lấy trạng thái bãi xe:',
              error
            );

            this.parkingError.set(
              'Không thể kết nối Backend.'
            );

            this.parkingLoading.set(false);

            return EMPTY;
          })

        )
      ),

      takeUntilDestroyed(this.destroyRef)

    ).subscribe(data => {

      this.parkingSpots.set(data);

      this.parkingLoading.set(false);

      this.parkingError.set('');

    });

  }


  // =====================================
  // MỞ MODAL QUÉT QR
  // =====================================

  openCheckInScanner(): void {

    if (this.isProcessing()) {
      return;
    }

    this.checkedInSession.set(null);

    this.showSpotNotice.set(false);

    this.checkInError.set('');

    this.showCheckInScanner.set(true);

  }


  // =====================================
  // BẮT ĐẦU QUÉT QR
  // =====================================

  async startScanner(): Promise<void> {

    if (
      this.isScanning() ||
      this.isProcessing()
    ) {
      return;
    }

    const video = this.cameraVideo?.nativeElement;

    if (!video) {

      this.checkInError.set(
        'Không tìm thấy camera. Vui lòng thử lại.'
      );

      return;
    }

    this.checkInError.set('');

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

            // Dừng camera sau khi đọc QR
            callbackControls.stop();

            this.scannerControls = null;

            this.isScanning.set(false);

            // Gửi QR lên Backend
            this.submitCheckIn(
              result.getText().trim()
            );

          }

        );

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

      this.checkInError.set(
        'Không thể mở camera. Hãy kiểm tra quyền truy cập camera.'
      );

    }

  }


  // =====================================
  // DỪNG CAMERA
  // =====================================

  stopScanner(): void {

    this.scannerControls?.stop();

    this.scannerControls = null;

    this.isScanning.set(false);

  }


  // =====================================
  // ĐÓNG MODAL QUÉT QR
  // =====================================

  closeCheckInScanner(): void {

    if (this.isProcessing()) {
      return;
    }

    this.stopScanner();

    this.showCheckInScanner.set(false);

    this.checkInError.set('');

  }


  // =====================================
  // GỬI CHECK-IN LÊN BACKEND
  // =====================================

  private submitCheckIn(qrPayload: string): void {

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

        // Lưu phiên gửi xe và vị trí Backend phân bổ
        this.checkedInSession.set(session);

        // Đóng modal camera
        this.showCheckInScanner.set(false);

        // Hiện thẻ thông báo vị trí
        this.showSpotNotice.set(true);

        this.checkInError.set('');

        this.isProcessing.set(false);

      },

      error: (error: HttpErrorResponse) => {

        console.error(
          'Check-in thất bại:',
          error
        );

        this.checkInError.set(
          this.getErrorMessage(error)
        );

        this.isProcessing.set(false);

      }

    });

  }


  // =====================================
  // XỬ LÝ THÔNG BÁO LỖI
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
  // ĐÓNG THẺ THÔNG BÁO VỊ TRÍ
  // =====================================

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showSpotNotice()) {
      this.closeSpotNotice();
      return;
    }

    if (this.showCheckInScanner()) {
      this.closeCheckInScanner();
    }
  }

  closeSpotNotice(): void {

    this.showSpotNotice.set(false);

  }


  // =====================================
  // MỞ / ĐÓNG CHỌN USER
  // =====================================

  toggleUserChooser(): void {

    this.showUserChooser.update(
      current => !current
    );

  }


  // =====================================
  // CHỌN USER
  // =====================================

  changeUser(id: DemoUserId): void {

    if (
      this.showSpotNotice() ||
      this.isProcessing()
    ) {
      return;
    }

    this.demoUsers.selectUser(id);

    this.showUserChooser.set(false);

  }


  // =====================================
  // HỦY CAMERA KHI RỜI TRANG
  // =====================================

  ngOnDestroy(): void {

    this.stopScanner();

  }

}
