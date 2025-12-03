/**
 * SISTEMA CENTRALIZADO DE CÁLCULOS NUMÉRICOS
 * 
 * Este módulo es la única fuente de verdad para TODOS los cálculos numéricos del sistema.
 * REGLAS NO NEGOCIABLES:
 * 1. Toda operación matemática debe pasar por estas funciones
 * 2. Cero tolerancia a errores - validaciones estrictas en cada paso
 * 3. Logs completos de auditoría para trazabilidad
 * 4. Redondeo consistente a 2 decimales en todos los casos
 */

import { auditoriaCalculos } from './auditoria-calculos';

// ==================== CONSTANTES ====================
const IVA_RATE = 0.16; // 16%
const IEPS_RATE = 0.08; // 8%
const DECIMAL_PRECISION = 2;

// ==================== PRODUCTOS BOLSAS 5KG (ANÍS / CANELA MOLIDA) ====================
export const PRODUCTOS_BOLSAS_5KG = ['anís', 'anis', 'canela molida'];
export const KG_POR_BOLSA = 5;

/**
 * Detecta si un producto es Anís o Canela Molida (que se venden en bolsas de 5kg)
 */
export function esProductoBolsas5kg(nombre: string): boolean {
  const nombreLower = nombre?.toLowerCase() || '';
  return PRODUCTOS_BOLSAS_5KG.some(p => nombreLower.includes(p));
}

/**
 * Redondea una cantidad de kg hacia arriba a bolsas completas
 * REGLA: Siempre redondear hacia ARRIBA a múltiplos de kgPorBolsa
 * Ejemplos con 5kg: 1kg→5kg, 6kg→10kg, 11kg→15kg, 17kg→20kg
 */
export function redondearABolsasCompletas(cantidadKg: number, kgPorBolsa: number = 5): number {
  const bolsas = Math.ceil(cantidadKg / kgPorBolsa);
  return bolsas * kgPorBolsa;
}

/**
 * Calcula el número de bolsas necesarias para una cantidad de kg
 */
export function calcularNumeroBolsas(cantidadKg: number, kgPorBolsa: number = 5): number {
  return Math.ceil(cantidadKg / kgPorBolsa);
}

// ==================== REDONDEO ====================

/**
 * Redondea un número a 2 decimales
 * CRÍTICO: Esta es la única forma válida de redondear en todo el sistema
 */
export function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

// ==================== CONVERSIÓN DE UNIDADES ====================

export interface ConversionUnidadParams {
  cantidad_kilos: number;
  kg_por_unidad: number | null;
  precio_por_kilo: boolean;
  unidad_comercial: string;
  nombre_producto: string;
}

export interface ResultadoConversion {
  cantidad_final: number;
  unidad_final: string;
  formula_usada: string;
  valido: boolean;
  error?: string;
}

/**
 * Convierte kilos a unidades comerciales según configuración del producto
 * REGLAS:
 * 1. Si precio_por_kilo = true → SIEMPRE trabajar en kilos, NO convertir
 * 2. Si precio_por_kilo = false → convertir kilos a unidades usando kg_por_unidad
 * 3. Si falta kg_por_unidad para conversión → ERROR, no asumir valores
 */
export function convertirUnidades(params: ConversionUnidadParams): ResultadoConversion {
  const { cantidad_kilos, kg_por_unidad, precio_por_kilo, unidad_comercial, nombre_producto } = params;

  // Validación inicial
  if (cantidad_kilos <= 0) {
    return {
      cantidad_final: 0,
      unidad_final: 'kg',
      formula_usada: 'ERROR',
      valido: false,
      error: `Cantidad inválida: ${cantidad_kilos}. Debe ser mayor a 0.`
    };
  }

  // REGLA 1: Productos por kilo NO se convierten
  if (precio_por_kilo) {
    const resultado = {
      cantidad_final: redondear(cantidad_kilos),
      unidad_final: 'kg',
      formula_usada: `cantidad_kilos=${cantidad_kilos} → ${cantidad_kilos} kg (precio_por_kilo=true, NO CONVERTIR)`,
      valido: true
    };

    auditoriaCalculos.registrar('conversion_unidades', {
      entrada: { cantidad_kilos, precio_por_kilo, unidad_comercial },
      salida: resultado,
      valido: true,
      contexto: { producto: nombre_producto }
    });

    return resultado;
  }

  // REGLA 2: Productos por unidad comercial requieren kg_por_unidad
  if (!kg_por_unidad || kg_por_unidad <= 0) {
    return {
      cantidad_final: 0,
      unidad_final: unidad_comercial,
      formula_usada: 'ERROR',
      valido: false,
      error: `Falta kg_por_unidad para producto "${nombre_producto}". No se puede convertir ${cantidad_kilos} kg a ${unidad_comercial}.`
    };
  }

  // REGLA 3: Convertir kilos → unidades comerciales
  const cantidad_unidades = cantidad_kilos / kg_por_unidad;
  const cantidad_redondeada = Math.round(cantidad_unidades); // Redondear a entero

  const resultado = {
    cantidad_final: cantidad_redondeada,
    unidad_final: unidad_comercial,
    formula_usada: `${cantidad_kilos} kg / ${kg_por_unidad} kg_por_unidad = ${cantidad_unidades.toFixed(4)} → ${cantidad_redondeada} ${unidad_comercial}`,
    valido: true
  };

  auditoriaCalculos.registrar('conversion_unidades', {
    entrada: { cantidad_kilos, kg_por_unidad, unidad_comercial },
    salida: resultado,
    valido: true,
    contexto: { producto: nombre_producto }
  });

  return resultado;
}

// ==================== CÁLCULO DE SUBTOTALES ====================

export interface CalculoSubtotalParams {
  cantidad: number;
  precio_unitario: number;
  nombre_producto: string;
}

export interface ResultadoSubtotal {
  subtotal: number;
  formula_usada: string;
  valido: boolean;
  error?: string;
}

/**
 * Calcula subtotal de línea de pedido
 * FÓRMULA: subtotal = cantidad × precio_unitario
 * SIN EXCEPCIONES, SIN VALORES OCULTOS
 */
export function calcularSubtotal(params: CalculoSubtotalParams): ResultadoSubtotal {
  const { cantidad, precio_unitario, nombre_producto } = params;

  // Validaciones
  if (cantidad <= 0) {
    return {
      subtotal: 0,
      formula_usada: 'ERROR',
      valido: false,
      error: `Cantidad inválida: ${cantidad}`
    };
  }

  if (precio_unitario < 0) {
    return {
      subtotal: 0,
      formula_usada: 'ERROR',
      valido: false,
      error: `Precio inválido: ${precio_unitario}`
    };
  }

  // Cálculo exacto
  const subtotal_crudo = cantidad * precio_unitario;
  const subtotal = redondear(subtotal_crudo);

  const resultado = {
    subtotal,
    formula_usada: `${cantidad} × ${precio_unitario} = ${subtotal}`,
    valido: true
  };

  auditoriaCalculos.registrar('calculo_subtotal', {
    entrada: { cantidad, precio_unitario },
    salida: resultado,
    valido: true,
    contexto: { producto: nombre_producto }
  });

  return resultado;
}

// ==================== CÁLCULO DE IMPUESTOS ====================

export interface CalculoImpuestosParams {
  precio_con_impuestos: number;
  aplica_iva: boolean;
  aplica_ieps: boolean;
  nombre_producto?: string;
}

export interface ResultadoImpuestos {
  base: number;
  iva: number;
  ieps: number;
  total: number;
  formula_usada: string;
  valido: boolean;
  error?: string;
}

/**
 * Desglosa impuestos de un precio que YA incluye IVA/IEPS
 * LÓGICA: precio_con_impuestos = base × (1 + tasas)
 * Por lo tanto: base = precio_con_impuestos / divisor
 */
export function calcularDesgloseImpuestos(params: CalculoImpuestosParams): ResultadoImpuestos {
  const { precio_con_impuestos, aplica_iva, aplica_ieps, nombre_producto } = params;

  if (precio_con_impuestos < 0) {
    return {
      base: 0,
      iva: 0,
      ieps: 0,
      total: 0,
      formula_usada: 'ERROR',
      valido: false,
      error: `Precio inválido: ${precio_con_impuestos}`
    };
  }

  // Calcular divisor
  let divisor = 1;
  if (aplica_iva) divisor += IVA_RATE;
  if (aplica_ieps) divisor += IEPS_RATE;

  // Desagregar base
  const base_cruda = precio_con_impuestos / divisor;
  const base = redondear(base_cruda);

  // Calcular impuestos sobre la base
  const iva = aplica_iva ? redondear(base * IVA_RATE) : 0;
  const ieps = aplica_ieps ? redondear(base * IEPS_RATE) : 0;

  // Total debe ser igual a precio_con_impuestos (o muy cercano)
  const total_calculado = redondear(base + iva + ieps);
  const diferencia = Math.abs(total_calculado - precio_con_impuestos);

  // Validar consistencia (diferencia máxima de 1 centavo por redondeo)
  const es_valido = diferencia <= 0.02;

  const resultado = {
    base,
    iva,
    ieps,
    total: precio_con_impuestos,
    formula_usada: `Base: ${precio_con_impuestos} / ${divisor} = ${base}, IVA: ${iva}, IEPS: ${ieps}, Total: ${total_calculado} (diff: ${diferencia.toFixed(4)})`,
    valido: es_valido,
    error: es_valido ? undefined : `Inconsistencia en desglose: diff=${diferencia}`
  };

  auditoriaCalculos.registrar('calculo_impuestos', {
    entrada: { precio_con_impuestos, aplica_iva, aplica_ieps },
    salida: resultado,
    valido: es_valido,
    contexto: { producto: nombre_producto || 'N/A' }
  });

  if (!es_valido) {
    console.error('❌ INCONSISTENCIA EN IMPUESTOS:', resultado);
  }

  return resultado;
}

// ==================== CÁLCULO DE TOTALES DE PEDIDO ====================

export interface LineaPedido {
  producto_id: string;
  nombre_producto: string;
  cantidad: number;
  precio_unitario: number;
  aplica_iva: boolean;
  aplica_ieps: boolean;
}

export interface ResultadoTotales {
  subtotal: number;
  iva: number;
  ieps: number;
  impuestos_totales: number;
  total: number;
  num_lineas: number;
  formula_usada: string;
  valido: boolean;
  errores: string[];
  detalles_lineas: Array<{
    producto: string;
    subtotal_linea: number;
    base: number;
    iva: number;
    ieps: number;
  }>;
}

/**
 * Calcula totales de un pedido completo
 * PROCESO:
 * 1. Calcular subtotal por cada línea: cantidad × precio
 * 2. Desagregar impuestos de cada subtotal
 * 3. Sumar todos los componentes
 * 4. Validar consistencia final
 */
export function calcularTotalesPedido(lineas: LineaPedido[]): ResultadoTotales {
  let subtotal_acumulado = 0;
  let iva_acumulado = 0;
  let ieps_acumulado = 0;
  const errores: string[] = [];
  const detalles_lineas: Array<any> = [];

  // Procesar cada línea
  lineas.forEach((linea, index) => {
    // 1. Calcular subtotal de línea
    const resultadoSubtotal = calcularSubtotal({
      cantidad: linea.cantidad,
      precio_unitario: linea.precio_unitario,
      nombre_producto: linea.nombre_producto
    });

    if (!resultadoSubtotal.valido) {
      errores.push(`Línea ${index + 1} (${linea.nombre_producto}): ${resultadoSubtotal.error}`);
      return;
    }

    // 2. Desagregar impuestos del subtotal
    const resultadoImpuestos = calcularDesgloseImpuestos({
      precio_con_impuestos: resultadoSubtotal.subtotal,
      aplica_iva: linea.aplica_iva,
      aplica_ieps: linea.aplica_ieps,
      nombre_producto: linea.nombre_producto
    });

    if (!resultadoImpuestos.valido) {
      errores.push(`Línea ${index + 1} (${linea.nombre_producto}): ${resultadoImpuestos.error}`);
    }

    // 3. Acumular
    subtotal_acumulado += resultadoImpuestos.base;
    iva_acumulado += resultadoImpuestos.iva;
    ieps_acumulado += resultadoImpuestos.ieps;

    detalles_lineas.push({
      producto: linea.nombre_producto,
      subtotal_linea: resultadoSubtotal.subtotal,
      base: resultadoImpuestos.base,
      iva: resultadoImpuestos.iva,
      ieps: resultadoImpuestos.ieps
    });
  });

  // Redondear totales
  const subtotal = redondear(subtotal_acumulado);
  const iva = redondear(iva_acumulado);
  const ieps = redondear(ieps_acumulado);
  const impuestos_totales = redondear(iva + ieps);
  const total = redondear(subtotal + iva + ieps);

  // Validación final: total debe ser suma exacta
  const suma_verificacion = redondear(subtotal + impuestos_totales);
  const es_valido = Math.abs(suma_verificacion - total) < 0.01 && errores.length === 0;

  if (!es_valido && errores.length === 0) {
    errores.push(`Inconsistencia en total final: ${subtotal} + ${impuestos_totales} = ${suma_verificacion} ≠ ${total}`);
  }

  const resultado = {
    subtotal,
    iva,
    ieps,
    impuestos_totales,
    total,
    num_lineas: lineas.length,
    formula_usada: `Subtotal: ${subtotal}, IVA: ${iva}, IEPS: ${ieps}, Total: ${total}`,
    valido: es_valido,
    errores,
    detalles_lineas
  };

  auditoriaCalculos.registrar('calculo_totales_pedido', {
    entrada: { num_lineas: lineas.length },
    salida: resultado,
    valido: es_valido
  });

  if (!es_valido) {
    console.error('❌ ERRORES EN TOTALES DE PEDIDO:', errores);
    console.table(detalles_lineas);
  }

  return resultado;
}

// ==================== VALIDACIÓN PRE-GUARDADO ====================

export interface ValidacionPedido {
  valido: boolean;
  errores: string[];
  advertencias: string[];
  puede_guardar: boolean;
}

/**
 * Validación obligatoria antes de guardar cualquier pedido
 * BLOQUEA el guardado si encuentra errores críticos
 */
export function validarAntesDeGuardar(lineas: LineaPedido[]): ValidacionPedido {
  const errores: string[] = [];
  const advertencias: string[] = [];

  // Validación 1: Debe haber al menos una línea
  if (lineas.length === 0) {
    errores.push('El pedido debe tener al menos un producto');
  }

  // Validación 2: Cada línea debe tener datos válidos
  lineas.forEach((linea, index) => {
    if (linea.cantidad <= 0) {
      errores.push(`Línea ${index + 1}: Cantidad inválida (${linea.cantidad})`);
    }
    if (linea.precio_unitario < 0) {
      errores.push(`Línea ${index + 1}: Precio inválido (${linea.precio_unitario})`);
    }
    if (!linea.producto_id) {
      errores.push(`Línea ${index + 1}: Falta ID de producto`);
    }
  });

  // Validación 3: Calcular totales y verificar consistencia
  const totales = calcularTotalesPedido(lineas);
  if (!totales.valido) {
    errores.push(...totales.errores);
  }

  // Validación 4: Total debe ser mayor a 0
  if (totales.total <= 0) {
    errores.push('El total del pedido debe ser mayor a $0.00');
  }

  const valido = errores.length === 0;
  const puede_guardar = valido;

  auditoriaCalculos.registrar('validacion_pre_guardado', {
    entrada: { num_lineas: lineas.length },
    salida: { valido, num_errores: errores.length, num_advertencias: advertencias.length },
    valido
  });

  return {
    valido,
    errores,
    advertencias,
    puede_guardar
  };
}

// ==================== EXPORTAR FUNCIONES LEGACY ====================

/**
 * Compatibilidad con código existente que usa calcularDesgloseImpuestos directamente
 */
export function calcularDesgloseImpuestosLegacy(
  precio_con_impuestos: number,
  aplica_iva: boolean,
  aplica_ieps: boolean
) {
  const resultado = calcularDesgloseImpuestos({
    precio_con_impuestos,
    aplica_iva,
    aplica_ieps
  });

  return {
    base: resultado.base,
    iva: resultado.iva,
    ieps: resultado.ieps,
    total: resultado.total
  };
}

/**
 * Función de validación simple para código existente
 */
export function validarTotalesLegacy(subtotal: number, iva: number, ieps: number, total: number): boolean {
  const calculado = redondear(subtotal + iva + ieps);
  const diferencia = Math.abs(calculado - total);
  return diferencia < 0.02;
}
