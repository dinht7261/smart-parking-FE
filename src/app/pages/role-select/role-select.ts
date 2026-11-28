import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppIcon } from '../../components/app-icon/app-icon';

@Component({
  selector: 'app-role-select',
  standalone: true,
  imports: [RouterLink, AppIcon],
  templateUrl: './role-select.html',
  styleUrl: './role-select.scss',
})
export class RoleSelect {}
