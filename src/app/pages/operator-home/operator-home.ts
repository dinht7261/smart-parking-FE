
import {
  Component,
  inject
} from '@angular/core';

import {
  RouterLink
} from '@angular/router';

import {
  ParkingLotService
} from '../../services/parking-lot.service';

import {
  AppSidebar,
  type SidebarMenuSection
} from '../../components/app-sidebar/app-sidebar';

@Component({
  selector: 'app-operator-home',
  standalone: true,

  imports: [
    RouterLink,
    AppSidebar
  ],

  templateUrl: './operator-home.html',
  styleUrl: './operator-home.scss'
})
export class OperatorHome {

  // =====================================
  // SERVICE QUẢN LÝ BÃI ĐỖ XE
  // =====================================

  readonly lot = inject(ParkingLotService);


  // =====================================
  // MENU NGƯỜI ĐIỀU HÀNH
  // =====================================

  readonly sidebarSections: SidebarMenuSection[] = [

    // =====================================
    // QUẢN LÝ BÃI XE
    // =====================================

    {
      title: 'Quản lý bãi xe',

      items: [
        {
          label: 'Điều khiển barrier',
          icon: '🚧',
          path: '/operator/barrier'
        }

      ]
    },


    // =====================================
    // QUẢN LÝ YÊU CẦU
    // =====================================

    {
      title: 'Quản lý yêu cầu',

      items: [

        {
          label: 'Duyệt yêu cầu gửi xe',
          icon: '📋',
          path: '/operator/requests'
        },
      ]
    },


    // =====================================
    // TÀI CHÍNH VÀ HÓA ĐƠN
    // =====================================

    {
      title: 'Tài chính & hóa đơn',

      items: [

        {
          label: 'Xử lý vi phạm',
          icon: '⚠️',
          path: '/operator/violations'
        },

        {
          label: 'Quản lý phí gửi xe',
          icon: '💳',
          path: '/operator/fees'
        },

        {
          label: 'Hóa đơn & thanh toán',
          icon: '🧾',
          path: '/operator/receipts'
        }

      ]
    },

  ];

}
