
import {
  Component,
  OnInit,
  ChangeDetectorRef,
  inject
} from '@angular/core';

import { Router } from '@angular/router';

import {
  CategoriesService,
  Category
} from '../../services/categories.service';

import {
  UserPreferencesService
} from '../../services/user-preferences.service';

import {
  OnboardingService
} from '../../services/onboarding.service';

@Component({
  selector: 'app-preferences',
  imports: [],
  templateUrl: './preferences.html',
  styleUrl: './preferences.css',
})
export class Preferences implements OnInit {

  categories: Category[] = [];
  selectedCategories: number[] = [];

  loading = false;
  saving = false;
  errorMessage = '';
  successMessage = '';

  private router = inject(Router);
  private changeDetector = inject(ChangeDetectorRef);
  private onboardingService = inject(OnboardingService);

  constructor(
    private categoriesService: CategoriesService,
    private preferencesService: UserPreferencesService
  ) {}

  ngOnInit(): void {
    this.loadPreferences();
  }

  /**
   * Carga las categorías y las preferencias guardadas.
   */
  async loadPreferences(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';

    try {
      this.categories =
        await this.categoriesService.getActiveCategories();

      this.selectedCategories =
        await this.preferencesService.getMyPreferences();

    } catch (error) {
      console.error('Error al cargar preferencias:', error);
      this.errorMessage =
        'No hemos podido cargar tus preferencias.';

    } finally {
      this.loading = false;
      this.changeDetector.detectChanges();
    }
  }

  /**
   * Selecciona o deselecciona una categoría.
   */
  toggleCategory(categoryId: number): void {

    if (this.selectedCategories.includes(categoryId)) {

      this.selectedCategories =
        this.selectedCategories.filter(id => id !== categoryId);

    } else {

      this.selectedCategories = [
        ...this.selectedCategories,
        categoryId
      ];

    }

    this.successMessage = '';
  }

  /**
   * Comprueba si una categoría está seleccionada.
   */
  isSelected(categoryId: number): boolean {
    return this.selectedCategories.includes(categoryId);
  }

  /**
   * Guarda las preferencias y completa la configuración inicial.
   */
  async savePreferences(): Promise<void> {

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {

      // Guardar las categorías seleccionadas
      await this.preferencesService.saveMyPreferences(
        this.selectedCategories
      );

      // Marcar la configuración inicial como completada
      await this.onboardingService.completeOnboarding();

      this.successMessage =
        '¡Tus preferencias se han guardado correctamente! 💜';

      // Ir a Home
      await this.router.navigate(['/home']);

    } catch (error) {

      console.error('Error al guardar preferencias:', error);

      this.errorMessage =
        'No hemos podido guardar tus preferencias. Inténtalo de nuevo.';

    } finally {

      this.saving = false;
      this.changeDetector.detectChanges();

    }
  }
}
