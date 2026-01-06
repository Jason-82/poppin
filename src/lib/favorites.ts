// LocalStorage helpers for managing favorite venues

const FAVORITES_KEY = 'poppin_favorites';

export function getFavorites(): string[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error reading favorites from localStorage:', error);
    return [];
  }
}

export function isFavorite(venueId: string): boolean {
  const favorites = getFavorites();
  return favorites.includes(venueId);
}

export function addFavorite(venueId: string): void {
  if (typeof window === 'undefined') return;

  try {
    const favorites = getFavorites();
    if (!favorites.includes(venueId)) {
      favorites.push(venueId);
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    }
  } catch (error) {
    console.error('Error adding favorite:', error);
  }
}

export function removeFavorite(venueId: string): void {
  if (typeof window === 'undefined') return;

  try {
    const favorites = getFavorites();
    const filtered = favorites.filter(id => id !== venueId);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error removing favorite:', error);
  }
}

export function toggleFavorite(venueId: string): boolean {
  const isCurrentlyFavorite = isFavorite(venueId);

  if (isCurrentlyFavorite) {
    removeFavorite(venueId);
    return false;
  } else {
    addFavorite(venueId);
    return true;
  }
}
