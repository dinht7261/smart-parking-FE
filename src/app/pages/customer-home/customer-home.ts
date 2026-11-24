
import {
  Component,
  inject,
  signal
} from '@angular/core';

import {
  RouterLink
} from '@angular/router';

import {
  ParkingLotService
} from '../../services/parking-lot.service';

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
export class CustomerHome {

  readonly lot = inject(ParkingLotService);

  readonly demoUsers = inject(DemoUserService);

  readonly showUserChooser = signal(false);

  readonly parkingMapRoute = '/customer/spaces';


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
        },
      ]
    }

  ];


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


  // =====================================
  // THỐNG KÊ BÃI XE
  // =====================================

  get availableSpaces(): number {
    return this.lot.availableCount();
  }

  get totalSpaces(): number {
    return this.lot.totalCount;
  }

}
