import { Injectable, inject } from '@angular/core';
import { EdgeClient } from '../api/edge.client';
import { AddCreatorInput, AddCreatorResult, ListCreatorsResult } from './admin-creator.types';

/**
 * Admin-only creator management. Adding a creator inserts the rows and fires the
 * sanctioned service-role platform-sync kicks server-side (admins are exempt from
 * the "no user-triggered external API calls" rule — see the design spec). Both
 * endpoints are admin-gated in the edge fn; adminGuard also gates the route.
 */
@Injectable({ providedIn: 'root' })
export class AdminCreatorService {
  private edge = inject(EdgeClient);

  async addCreators(creators: AddCreatorInput[]): Promise<AddCreatorResult> {
    return this.edge.post('admin-add-creator', { creators });
  }

  async listCreators(): Promise<ListCreatorsResult> {
    return this.edge.get('admin-list-creators');
  }
}
