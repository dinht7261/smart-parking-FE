
import {
  Component,
  HostListener,
  computed,
  input,
  signal
} from '@angular/core';

import {
  RouterLink,
  RouterLinkActive
} from '@angular/router';

// =====================================
// ĐƯỜNG DẪN LỊCH SỬ SESSION
// =====================================

// Đối chiếu với route Angular hiện tại.
// Nếu route của trang OperatorSessions khác,
// chỉ cần thay đổi giá trị này.

const OPERATOR_SESSION_PATH = '/operator/sessions';

// =====================================
// PHÂN QUYỀN MENU
// =====================================

export type SidebarRole =
  | 'customer'
  | 'operator';

// =====================================
// CẤU TRÚC TỪNG CHỨC NĂNG
// =====================================

export interface SidebarMenuItem {

  label: string;

  path: string;

  icon: string;

  description?: string;
}

// =====================================
// CẤU TRÚC NHÓM MENU
// =====================================

export interface SidebarMenuSection {

  title: string;

  items: SidebarMenuItem[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,

  imports: [
    RouterLink,
    RouterLinkActive
  ],

  templateUrl: './app-sidebar.html',

  styleUrl: './app-sidebar.scss'
})
export class AppSidebar {

  // =====================================
  // INPUT
  // =====================================

  readonly role = input.required<SidebarRole>();

  readonly sections =
    input.required<SidebarMenuSection[]>();

  // =====================================
  // TRẠNG THÁI SIDEBAR
  // =====================================

  readonly opened = signal(false);

  readonly query = signal('');

  // =====================================
  // TÊN VAI TRÒ
  // =====================================

  readonly roleTitle = computed(() => {

    return this.role() === 'operator'
      ? 'Người điều hành'
      : 'Người dùng';

  });

  // =====================================
  // ĐƯỜNG DẪN TRANG CHỦ
  // =====================================

  readonly homePath = computed(() => {

    return this.role() === 'operator'
      ? '/operator'
      : '/customer';

  });

  // =====================================
  // XỬ LÝ DANH SÁCH MENU
  //
  // 1. Đổi tên mục yêu cầu gửi xe.
  // 2. Thêm mục Lịch sử xe vào/ra.
  // 3. Chỉ áp dụng cho OPERATOR.
  // =====================================

  readonly menuSections = computed(() => {

    const sections = this.sections();

    // Không thay đổi menu khách hàng

    if (this.role() !== 'operator') {

      return sections;

    }

    // Đổi tên mục yêu cầu gửi xe

    const updatedSections = sections.map(section => ({

      ...section,

      items: section.items.map(item => {

        if (
          this.normalize(item.label) ===
          this.normalize('Duyệt yêu cầu gửi xe')
        ) {

          return {

            ...item,

            label: 'Các yêu cầu đặt chỗ'

          };

        }

        return item;

      })

    }));

    // Kiểm tra Session đã có trong menu chưa

    const hasSessionMenu = updatedSections.some(
      section => section.items.some(item =>

        item.path === OPERATOR_SESSION_PATH ||
        this.normalize(item.label) ===
        this.normalize('Lịch sử xe vào/ra')

      )
    );

    // Tránh thêm trùng menu

    if (hasSessionMenu) {

      return updatedSections;

    }

    // Mục lịch sử Session
    // Chỉ điều hướng đến trang theo dõi

    const sessionItem: SidebarMenuItem = {

      label: 'Lịch sử xe vào/ra',

      path: OPERATOR_SESSION_PATH,

      icon: '🚘',


    };

    // Tìm nhóm Quản lý bãi xe

    const parkingSectionIndex =
      updatedSections.findIndex(section =>

        this.normalize(section.title) ===
        this.normalize('QUẢN LÝ BÃI XE')

      );

    if (parkingSectionIndex !== -1) {

      // Thêm vào nhóm Quản lý bãi xe

      const targetSection =
        updatedSections[parkingSectionIndex];

      updatedSections[parkingSectionIndex] = {

        ...targetSection,

        items: [

          ...targetSection.items,

          sessionItem

        ]

      };

    } else {

      // Nếu chưa có nhóm thì tạo nhóm mới

      updatedSections.unshift({

        title: 'THEO DÕI BÃI XE',

        items: [

          sessionItem

        ]

      });

    }

    return updatedSections;

  });

  // =====================================
  // TÌM KIẾM CHỨC NĂNG
  // =====================================

  readonly visibleSections = computed(() => {

    const keyword = this.normalize(
      this.query()
    );

    const sections = this.menuSections();

    if (!keyword) {

      return sections;

    }

    return sections

      .map(section => ({

        ...section,

        items: section.items.filter(item => {

          const text = this.normalize(

            item.label + ' ' +
            (item.description ?? '')

          );

          return text.includes(keyword);

        })

      }))

      .filter(
        section => section.items.length > 0
      );

  });

  // =====================================
  // MỞ MENU
  // =====================================

  openMenu(): void {

    this.query.set('');

    this.opened.set(true);

  }

  // =====================================
  // ĐÓNG MENU
  // =====================================

  closeMenu(): void {

    this.opened.set(false);

    this.query.set('');

  }

  // =====================================
  // ĐÓNG BẰNG PHÍM ESC
  // =====================================

  @HostListener('document:keydown.escape')

  onEscape(): void {

    if (this.opened()) {

      this.closeMenu();

    }

  }

  // =====================================
  // CHUẨN HÓA TÌM KIẾM TIẾNG VIỆT
  // =====================================

  private normalize(value: string): string {

    return value

      .normalize('NFD')

      .replace(/[\u0300-\u036f]/g, '')

      .replace(/đ/g, 'd')

      .replace(/Đ/g, 'D')

      .toLowerCase()

      .trim();

  }

}
