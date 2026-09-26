import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Duração de filme: 142 -> "2h 22m". */
export function formatMinutes(minutes?: number | null): string {
  if (!minutes) return '';
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${remainingMinutes}min`;
  return `${hours}h ${remainingMinutes.toString().padStart(2, '0')}m`;
}

/** Tempo do player: 215 -> "3:35". */
export function formatSeconds(seconds?: number | null): string {
  if (!Number.isFinite(seconds) || (seconds ?? 0) < 0) return '0:00';
  const total = Math.floor(seconds as number);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function formatDatePtBr(dateString?: string | null): string {
  if (!dateString) return '';
  try {
    const [year, month, day] = dateString.split('T')[0].split('-');
    return `${day}/${month}/${year}`;
  } catch {
    return dateString;
  }
}
