/**
 * SISTEMA DE AUDITORÍA DE CÁLCULOS
 * 
 * Registra TODAS las operaciones numéricas del sistema para trazabilidad completa.
 * Permite detectar errores, revisar cálculos históricos y debugging avanzado.
 */

export interface RegistroAuditoria {
  timestamp: string;
  operacion: string;
  entrada: any;
  salida: any;
  valido: boolean;
  duracion_ms?: number;
  contexto?: any; // Contexto adicional (producto, cliente, etc.)
}

class AuditoriaCalculos {
  private registros: RegistroAuditoria[] = [];
  private maxRegistros = 1000; // Mantener últimos 1000 registros en memoria
  private habilitado = true;

  /**
   * Registra una operación matemática
   */
  registrar(operacion: string, datos: Omit<RegistroAuditoria, 'timestamp' | 'operacion'>) {
    if (!this.habilitado) return;

    const registro: RegistroAuditoria = {
      timestamp: new Date().toISOString(),
      operacion,
      ...datos
    };

    this.registros.push(registro);

    // Mantener solo los últimos maxRegistros
    if (this.registros.length > this.maxRegistros) {
      this.registros.shift();
    }

    // Log en consola si hay error
    if (!datos.valido) {
      console.error(`❌ ERROR en ${operacion}:`, registro);
    } else {
      console.log(`✅ ${operacion}:`, registro.entrada, '→', registro.salida);
    }
  }

  /**
   * Obtiene todos los registros
   */
  obtenerRegistros(): RegistroAuditoria[] {
    return [...this.registros];
  }

  /**
   * Obtiene registros con errores
   */
  obtenerErrores(): RegistroAuditoria[] {
    return this.registros.filter(r => !r.valido);
  }

  /**
   * Obtiene últimos N registros
   */
  obtenerUltimos(n: number): RegistroAuditoria[] {
    return this.registros.slice(-n);
  }

  /**
   * Filtra registros por tipo de operación
   */
  filtrarPorOperacion(operacion: string): RegistroAuditoria[] {
    return this.registros.filter(r => r.operacion === operacion);
  }

  /**
   * Genera reporte de auditoría
   */
  generarReporte(): {
    total_operaciones: number;
    operaciones_exitosas: number;
    operaciones_con_error: number;
    tipos_operacion: Record<string, number>;
    ultimos_errores: RegistroAuditoria[];
  } {
    const tipos_operacion: Record<string, number> = {};
    let operaciones_exitosas = 0;
    let operaciones_con_error = 0;

    this.registros.forEach(r => {
      tipos_operacion[r.operacion] = (tipos_operacion[r.operacion] || 0) + 1;
      if (r.valido) {
        operaciones_exitosas++;
      } else {
        operaciones_con_error++;
      }
    });

    return {
      total_operaciones: this.registros.length,
      operaciones_exitosas,
      operaciones_con_error,
      tipos_operacion,
      ultimos_errores: this.obtenerErrores().slice(-10)
    };
  }

  /**
   * Limpia todos los registros
   */
  limpiar() {
    this.registros = [];
    console.log('🧹 Auditoría de cálculos limpiada');
  }

  /**
   * Habilita/deshabilita auditoría
   */
  setHabilitado(habilitado: boolean) {
    this.habilitado = habilitado;
    console.log(`📊 Auditoría de cálculos ${habilitado ? 'habilitada' : 'deshabilitada'}`);
  }

  /**
   * Exporta registros como JSON
   */
  exportarJSON(): string {
    return JSON.stringify(this.registros, null, 2);
  }

  /**
   * Exporta reporte como texto
   */
  exportarReporte(): string {
    const reporte = this.generarReporte();
    let texto = '=== REPORTE DE AUDITORÍA DE CÁLCULOS ===\n\n';
    texto += `Total de operaciones: ${reporte.total_operaciones}\n`;
    texto += `Operaciones exitosas: ${reporte.operaciones_exitosas}\n`;
    texto += `Operaciones con error: ${reporte.operaciones_con_error}\n\n`;
    texto += '=== TIPOS DE OPERACIÓN ===\n';
    Object.entries(reporte.tipos_operacion).forEach(([tipo, count]) => {
      texto += `${tipo}: ${count}\n`;
    });
    texto += '\n=== ÚLTIMOS ERRORES ===\n';
    reporte.ultimos_errores.forEach(error => {
      texto += `[${error.timestamp}] ${error.operacion}\n`;
      texto += `  Entrada: ${JSON.stringify(error.entrada)}\n`;
      texto += `  Salida: ${JSON.stringify(error.salida)}\n\n`;
    });
    return texto;
  }
}

// Instancia singleton
export const auditoriaCalculos = new AuditoriaCalculos();

// Exponer en window para debugging desde consola del navegador
if (typeof window !== 'undefined') {
  (window as any).auditoriaCalculos = auditoriaCalculos;
  console.log('💡 TIP: Usa window.auditoriaCalculos en la consola para ver registros de cálculos');
}
