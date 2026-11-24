import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import {
  ParkingReceiptNotice
} from './components/parking-receipt-notice/parking-receipt-notice';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    ParkingReceiptNotice
  ],
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
}