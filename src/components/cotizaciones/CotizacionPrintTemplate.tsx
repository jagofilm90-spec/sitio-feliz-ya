import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ProductoCotizacion {
  codigo: string;
  nombre: string;
  unidad: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  cantidad_maxima?: number | null;
  nota_linea?: string | null;
  tipo_precio?: string | null;
}

interface DatosCotizacion {
  folio: string;
  nombre?: string;
  fecha_creacion: string;
  fecha_vigencia: string;
  cliente: {
    nombre: string;
    codigo: string;
    email?: string;
  };
  sucursal?: {
    nombre: string;
    direccion?: string;
  };
  productos: ProductoCotizacion[];
  subtotal: number;
  iva: number;
  ieps: number;
  total: number;
  notas?: string;
  soloPrecios?: boolean;
}

interface CotizacionPrintTemplateProps {
  datos: DatosCotizacion;
}

// Helper to parse date correctly avoiding timezone issues
const parseDateLocal = (dateStr: string) => {
  if (!dateStr) return new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const CotizacionPrintTemplate = ({ datos }: CotizacionPrintTemplateProps) => {
  const fechaCreacion = format(new Date(datos.fecha_creacion), "dd 'de' MMMM 'de' yyyy", { locale: es });
  const fechaVigencia = format(parseDateLocal(datos.fecha_vigencia), "dd 'de' MMMM 'de' yyyy", { locale: es });
  
  return (
    <div className="p-8 bg-white text-black min-h-[11in] w-[8.5in] mx-auto font-sans text-sm print:p-6">
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-primary pb-4 mb-4">
        <div className="flex items-center gap-4">
          <img 
            src="/logo-almasa-favicon.png" 
            alt="ALMASA" 
            className="h-16 w-16 object-contain"
          />
          <div>
            <h1 className="text-2xl font-bold text-primary">ABARROTES LA MANITA</h1>
            <p className="text-xs text-gray-600">ABARROTES LA MANITA, S.A. DE C.V.</p>
          </div>
        </div>
        <div className="text-right">
          <div className="bg-primary text-primary-foreground px-4 py-2 rounded font-bold text-lg">
            COTIZACIÓN
          </div>
          <p className="text-xs mt-1">Folio: <span className="font-bold">{datos.folio}</span></p>
          <p className="text-xs">Fecha: {fechaCreacion}</p>
        </div>
      </div>

      {/* Company Info */}
      <div className="grid grid-cols-2 gap-6 mb-4 text-xs">
        <div>
          <p className="font-semibold">Dirección Fiscal:</p>
          <p>Calle: MELCHOR OCAMPO No.Ext: 59</p>
          <p>Colonia: MAGDALENA MIXIUHCA</p>
          <p>Municipio: VENUSTIANO CARRANZA C.P.:15850</p>
          <p className="mt-1">Tel: (55) 56-00-77-81 / (55) 56-94-97-92</p>
        </div>
        <div>
          <p className="font-semibold text-primary">Vigencia de la cotización:</p>
          <p className="font-bold text-lg">{fechaVigencia}</p>
          {datos.nombre && (
            <p className="mt-2"><span className="font-semibold">Referencia:</span> {datos.nombre}</p>
          )}
        </div>
      </div>

      {/* Client Info */}
      <div className="bg-gray-100 p-3 rounded mb-4">
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <p><span className="font-semibold">Cliente:</span> {datos.cliente.nombre}</p>
            <p><span className="font-semibold">Código:</span> {datos.cliente.codigo}</p>
            {datos.cliente.email && (
              <p><span className="font-semibold">Email:</span> {datos.cliente.email}</p>
            )}
          </div>
          <div>
            {datos.sucursal && (
              <>
                <p><span className="font-semibold">Sucursal:</span> {datos.sucursal.nombre}</p>
                {datos.sucursal.direccion && (
                  <p><span className="font-semibold">Dirección:</span> {datos.sucursal.direccion}</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Products Table */}
      <table className="w-full mb-4 text-xs">
        <thead>
          <tr className="bg-gray-800 text-white">
            <th className="p-2 text-left w-20">Código</th>
            <th className="p-2 text-left">Producto</th>
            <th className="p-2 text-center w-20">Tipo</th>
            {!datos.soloPrecios && (
              <>
                <th className="p-2 text-center w-20">Cantidad</th>
                <th className="p-2 text-center w-16">Unidad</th>
              </>
            )}
            <th className="p-2 text-right w-24">Precio</th>
            {!datos.soloPrecios && (
              <th className="p-2 text-right w-24">Subtotal</th>
            )}
          </tr>
        </thead>
        <tbody>
          {datos.productos.map((producto, index) => (
            <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              <td className="p-2 border-b font-mono">{producto.codigo}</td>
              <td className="p-2 border-b">
                <div>
                  {producto.nombre}
                  {(producto.cantidad_maxima || producto.nota_linea) && (
                    <div className="text-[10px] text-amber-700 mt-0.5 font-medium">
                      {producto.cantidad_maxima && (
                        <span>Máx: {producto.cantidad_maxima.toLocaleString()} {producto.unidad}</span>
                      )}
                      {producto.cantidad_maxima && producto.nota_linea && <span> • </span>}
                      {producto.nota_linea && <span>{producto.nota_linea}</span>}
                    </div>
                  )}
                </div>
              </td>
              <td className="p-2 border-b text-center text-[10px]">
                <span className="bg-gray-200 px-1.5 py-0.5 rounded">
                  {producto.tipo_precio?.replace('por_', '') || 'N/A'}
                </span>
              </td>
              {!datos.soloPrecios && (
                <>
                  <td className="p-2 border-b text-center">{producto.cantidad}</td>
                  <td className="p-2 border-b text-center">{producto.unidad}</td>
                </>
              )}
              <td className="p-2 border-b text-right">
                ${producto.precio_unitario.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </td>
              {!datos.soloPrecios && (
                <td className="p-2 border-b text-right">
                  ${producto.subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </td>
              )}
            </tr>
          ))}
          {/* Empty rows to fill space */}
          {Array.from({ length: Math.max(0, 10 - datos.productos.length) }).map((_, i) => (
            <tr key={`empty-${i}`} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              <td className="p-2 border-b">&nbsp;</td>
              <td className="p-2 border-b"></td>
              <td className="p-2 border-b"></td>
              {!datos.soloPrecios && (
                <>
                  <td className="p-2 border-b"></td>
                  <td className="p-2 border-b"></td>
                </>
              )}
              <td className="p-2 border-b"></td>
              {!datos.soloPrecios && <td className="p-2 border-b"></td>}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      {!datos.soloPrecios && (
        <div className="flex justify-end mb-4">
          <table className="text-sm w-64">
            <tbody>
              <tr>
                <td className="p-2 font-semibold text-right">Subtotal:</td>
                <td className="p-2 text-right w-32 border">
                  ${datos.subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </td>
              </tr>
              <tr>
                <td className="p-2 font-semibold text-right">IVA (16%):</td>
                <td className="p-2 text-right border">
                  ${datos.iva.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </td>
              </tr>
              {datos.ieps > 0 && (
                <tr>
                  <td className="p-2 font-semibold text-right">IEPS (8%):</td>
                  <td className="p-2 text-right border">
                    ${datos.ieps.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              )}
              <tr className="bg-gray-800 text-white">
                <td className="p-2 font-bold text-right">Total:</td>
                <td className="p-2 text-right font-bold">
                  ${datos.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Notes */}
      {datos.notas && (
        <div className="border p-3 rounded mb-4 text-xs">
          <p className="font-semibold mb-1">Notas:</p>
          <p className="text-gray-700">{datos.notas}</p>
        </div>
      )}

      {/* Terms */}
      <div className="border-2 border-gray-300 p-3 text-[10px] leading-tight mb-4">
        <p className="text-center font-bold mb-2">TÉRMINOS Y CONDICIONES</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Los precios están expresados en pesos mexicanos (MXN).</li>
          <li>Esta cotización tiene vigencia hasta la fecha indicada.</li>
          <li>Los precios pueden variar sin previo aviso después de la fecha de vigencia.</li>
          <li>Los tiempos de entrega se confirmarán al momento de realizar el pedido.</li>
          <li>Los precios incluyen impuestos cuando aplique.</li>
        </ul>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-gray-600 border-t pt-3">
        <p className="font-bold">ABARROTES LA MANITA S.A. DE C.V.</p>
        <p>Email: 1904@almasa.com.mx | Tel: (55) 56-00-77-81</p>
        <p className="mt-1 italic">Gracias por su preferencia</p>
      </div>
    </div>
  );
};

export default CotizacionPrintTemplate;
