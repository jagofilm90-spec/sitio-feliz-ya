import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { calcularDesgloseImpuestosLegacy, validarTotalesLegacy } from "./calculos";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatea un número como moneda con separador de miles (comas) y 2 decimales
 * Ejemplo: 9100 -> "9,100.00"
 */
export function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Calcula el desglose de impuestos para productos con precios que incluyen IVA/IEPS
 * NOTA: Esta función ahora usa el sistema centralizado de cálculos (src/lib/calculos.ts)
 * @param precioConImpuestos - Precio total incluyendo impuestos
 * @param aplica_iva - Si el producto tiene IVA (16%)
 * @param aplica_ieps - Si el producto tiene IEPS (8%)
 * @returns { base, iva, ieps, total }
 */
export function calcularDesgloseImpuestos(
  precioConImpuestos: number,
  aplica_iva: boolean,
  aplica_ieps: boolean
) {
  return calcularDesgloseImpuestosLegacy(precioConImpuestos, aplica_iva, aplica_ieps);
}

/**
 * Valida que los totales sean consistentes
 * NOTA: Esta función ahora usa el sistema centralizado de cálculos (src/lib/calculos.ts)
 */
export function validarTotales(subtotal: number, iva: number, ieps: number, total: number): boolean {
  return validarTotalesLegacy(subtotal, iva, ieps, total);
}
