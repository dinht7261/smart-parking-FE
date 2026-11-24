
import { Routes } from '@angular/router';

import { RoleSelect } from './pages/role-select/role-select';
import { CustomerHome } from './pages/customer-home/customer-home';
import { OperatorHome } from './pages/operator-home/operator-home';

import { ParkingSpaces } from './pages/parking-spaces/parking-spaces';
import { OperatorSpaces } from './pages/operator-spaces/operator-spaces';

import { OperatorRequests } from './pages/operator-requests/operator-requests';
import { BookingRequest } from './pages/booking-request/booking-request';
import { CustomerRequests } from './pages/customer-requests/customer-requests';

import { OvernightRequestPage } from './pages/overnight-request/overnight-request';
import { OperatorOvernight } from './pages/operator-overnight/operator-overnight';

import { OperatorBarrier } from './pages/operator-barrier/operator-barrier';
import { OperatorSessions } from './pages/operator-sessions/operator-sessions';

import { OperatorViolations } from './pages/operator-violations/operator-violations';
import { OperatorFees } from './pages/operator-fees/operator-fees';
import {
  OperatorUnifiedRequests
} from './pages/operator-unified-requests/operator-unified-requests';
// TRANG CẤU HÌNH MỚI
import {
  OperatorSpotConfig
} from './pages/operator-spot-config/operator-spot-config';

import {
  CustomerCheckIn
} from './pages/customer-check-in/customer-check-in';

export const routes: Routes = [

  {
    path: '',
    component: RoleSelect
  },

  {
    path: 'customer',
    component: CustomerHome
  },

  {
    path: 'customer/spaces',
    component: ParkingSpaces
  },

  {
    path: 'customer/booking',
    component: BookingRequest
  },

  {
    path: 'customer/requests',
    component: CustomerRequests
  },


{
  path: 'customer/overnight',
  component: OvernightRequestPage
},



  {
    path: 'customer/receipts',
    loadComponent: () =>
      import('./pages/receipt-history/receipt-history')
        .then(m => m.ReceiptHistory)
  },

  {
    path: 'operator',
    component: OperatorHome
  },

  {
    path: 'operator/spaces',
    component: OperatorSpaces
  },

  {
    path: 'operator/spot-config',
    component: OperatorSpotConfig
  },

  {
    path: 'operator/requests',
    component: OperatorUnifiedRequests
  },


{
  path: 'operator/overnight',
  redirectTo: 'operator/requests',
  pathMatch: 'full'
},


  {
    path: 'operator/barrier',
    component: OperatorBarrier
  },

  {
    path: 'operator/sessions',
    component: OperatorSessions
  },

  {
    path: 'operator/violations',
    component: OperatorViolations
  },

  {
    path: 'operator/fees',
    component: OperatorFees
  },

  {
    path: 'operator/receipts',
    loadComponent: () =>
      import('./pages/receipt-history/receipt-history')
        .then(m => m.ReceiptHistory)
  },


{
  path: 'customer/check-in',
  loadComponent: () =>
    import('./pages/customer-check-in/customer-check-in')
      .then(m => m.CustomerCheckIn)
},

{
  path: 'customer/check-in',
  component: CustomerCheckIn
},

  {
    path: '**',
    redirectTo: ''
  }

];
