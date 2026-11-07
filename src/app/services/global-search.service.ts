import { Injectable } from '@angular/core';
import { ReplaySubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GlobalSearchService {
  private readonly searchSubject = new ReplaySubject<string>(1);

  readonly search$ = this.searchSubject.asObservable();

  private lastQuery: string | null = null;

  get currentQuery(): string | null {
    return this.lastQuery;
  }

  search(query: string): void {
    const normalizedQuery = query.trim();
    this.lastQuery = normalizedQuery;
    this.searchSubject.next(normalizedQuery);
  }
}
