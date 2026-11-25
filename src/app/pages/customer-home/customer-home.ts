
import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';

import { RouterLink } from '@angular/router';

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
export class CustomerHome implements OnInit {

  private readonly api = inject(ParkingSpotsApiService);

  private readonly destroyRef = inject(DestroyRef);

  readonly demoUsers = inject(DemoUserService);

  readonly showUserChooser = signal(false);

  readonly parkingMapRoute = '/customer/spaces';

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
  // ĐỒNG BỘ DỮ LIỆU TỪ BACKEND
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

    this.demoUsers.selectUser(id);

    this.showUserChooser.set(false);
  }

}
