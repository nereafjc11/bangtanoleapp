
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CommunityCatalogItem } from '../../services/community-catalog.service';
import { CatalogItem, TmdbService } from '../../services/tmdb.service';


@Component({
  selector: 'app-ficha-duplicate-modals',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ficha-duplicate-modals.html',
  styleUrl: './ficha-duplicate-modals.css',
})
export class FichaDuplicateModals {
  @Input() showDuplicate = false;
  @Input() duplicateItem: CommunityCatalogItem | null = null;
  @Input() duplicateTmdbPosterPath: string | null = null;

  @Input() showSimilar = false;
  @Input() communityMatches: CommunityCatalogItem[] = [];
  @Input() similarTmdbPosterPath: string | null = null;

  @Input() posterPreview: string | null = null;
  @Input() selectedTmdb: CatalogItem | null = null;
  @Input() usesTmdb = false;

  @Input() previewTitle = '';
  @Input() selectedCategoryLabel = '';
  @Input() year: number | null = null;
  @Input() genresText = '';
  @Input() confirmedDifferent = false;

  @Output() dismissDuplicate = new EventEmitter<void>();
  @Output() openExisting = new EventEmitter<void>();
  @Output() closeSimilar = new EventEmitter<void>();
  @Output() confirmedDifferentChange = new EventEmitter<boolean>();
  @Output() confirmDifferent = new EventEmitter<void>();

  constructor(public tmdb: TmdbService) {}
}
