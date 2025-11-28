import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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
  // Calcular divisor según impuestos aplicables
  let divisor = 1;
  if (aplica_iva) divisor += 0.16;
  if (aplica_ieps) divisor += 0.08;
  
  // Precio base sin impuestos
  const base = precioConImpuestos / divisor;
  
  // Calcular impuestos
  const iva = aplica_iva ? base * 0.16 : 0;
  const ieps = aplica_ieps ? base * 0.08 : 0;
  
  return {
    base: Math.round(base * 100) / 100,
    iva: Math.round(iva * 100) / 100,
    ieps: Math.round(ieps * 100) / 100,
    total: Math.round(precioConImpuestos * 100) / 100,
  };
}

/**
 * Valida que los totales sean consistentes
 */
export function validarTotales(subtotal: number, iva: number, ieps: number, total: number): boolean {
  const calculado = subtotal + iva + ieps;
  // Permitir diferencia de 1 centavo por redondeo
  return Math.abs(calculado - total) < 0.02;
}
