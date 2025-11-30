import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ProductoRemision {
  cantidad: number;
  unidad: string;
  descripcion: string;
  precio_unitario: number;
  total: number;
}

interface DatosRemision {
  folio: string;
  fecha: string;
  cliente: {
    nombre: string;
    rfc?: string;
    direccion_fiscal?: string;
    telefono?: string;
  };
  sucursal?: {
    nombre: string;
    direccion?: string;
  };
  productos: ProductoRemision[];
  subtotal: number;
  iva: number;
  total: number;
  condiciones_credito: string;
  vendedor?: string;
  notas?: string;
}

interface RemisionPrintTemplateProps {
  datos: DatosRemision;
}

export const RemisionPrintTemplate = ({ datos }: RemisionPrintTemplateProps) => {
  const fechaFormateada = format(new Date(datos.fecha), "dd 'de' MMMM 'de' yyyy", { locale: es });
  
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
            NOTA DE VENTA
          </div>
          <p className="text-xs mt-1">Folio: <span className="font-bold">{datos.folio}</span></p>
          <p className="text-xs">Fecha: {fechaFormateada}</p>
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
          <p className="font-semibold">Dirección Entrega:</p>
          <p>Calle: MELCHOR OCAMPO No.Ext: 59</p>
          <p>Colonia: MAGDALENA MIXIUHCA</p>
          <p>Municipio: VENUSTIANO CARRANZA C.P.:15850</p>
        </div>
      </div>

      {/* Client Info */}
      <div className="bg-gray-100 p-3 rounded mb-4">
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <p><span className="font-semibold">Cliente:</span> {datos.cliente.nombre}</p>
            {datos.cliente.rfc && <p><span className="font-semibold">RFC:</span> {datos.cliente.rfc}</p>}
            {datos.cliente.direccion_fiscal && (
              <p><span className="font-semibold">Dirección:</span> {datos.cliente.direccion_fiscal}</p>
            )}
          </div>
          <div>
            {datos.sucursal && (
              <>
                <p><span className="font-semibold">Sucursal:</span> {datos.sucursal.nombre}</p>
                {datos.sucursal.direccion && (
                  <p><span className="font-semibold">Entrega:</span> {datos.sucursal.direccion}</p>
                )}
              </>
            )}
            {datos.cliente.telefono && (
              <p><span className="font-semibold">Tel:</span> {datos.cliente.telefono}</p>
            )}
          </div>
        </div>
      </div>

      {/* Products Table */}
      <table className="w-full mb-4 text-xs">
        <thead>
          <tr className="bg-gray-800 text-white">
            <th className="p-2 text-left w-16">Cantidad</th>
            <th className="p-2 text-left w-20">Empaque</th>
            <th className="p-2 text-left">Descripción</th>
            <th className="p-2 text-right w-24">P.Unitario</th>
            <th className="p-2 text-right w-24">Total</th>
          </tr>
        </thead>
        <tbody>
          {datos.productos.map((producto, index) => (
            <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              <td className="p-2 border-b">{producto.cantidad}</td>
              <td className="p-2 border-b">{producto.unidad}</td>
              <td className="p-2 border-b">{producto.descripcion}</td>
              <td className="p-2 border-b text-right">${producto.precio_unitario.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
              <td className="p-2 border-b text-right">${producto.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
            </tr>
          ))}
          {/* Empty rows to fill space */}
          {Array.from({ length: Math.max(0, 8 - datos.productos.length) }).map((_, i) => (
            <tr key={`empty-${i}`} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              <td className="p-2 border-b">&nbsp;</td>
              <td className="p-2 border-b"></td>
              <td className="p-2 border-b"></td>
              <td className="p-2 border-b"></td>
              <td className="p-2 border-b"></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals and Payment Info */}
      <div className="grid grid-cols-2 gap-6 mb-4">
        <div className="text-xs space-y-2">
          <div className="border p-2 rounded">
            <p className="font-semibold mb-1">Para Depósito o Transferencia Bancaria a Nombre de:</p>
            <p>ABARROTES LA MANITA S.A. DE C.V.</p>
            <p className="mt-1"><span className="font-semibold">Referencia:</span> {datos.folio}</p>
          </div>
          <div className="border p-2 rounded">
            <p><span className="font-semibold">Condiciones de Crédito:</span> {datos.condiciones_credito}</p>
            {datos.vendedor && <p><span className="font-semibold">Vendedor:</span> {datos.vendedor}</p>}
          </div>
        </div>
        <div>
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="p-2 font-semibold text-right">SubTotal:</td>
                <td className="p-2 text-right w-32 border">${datos.subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td className="p-2 font-semibold text-right">I.V.A.:</td>
                <td className="p-2 text-right border">${datos.iva.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr className="bg-gray-800 text-white">
                <td className="p-2 font-bold text-right">G. Total:</td>
                <td className="p-2 text-right font-bold">${datos.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagaré */}
      <div className="border-2 border-gray-400 p-3 text-[10px] leading-tight mb-4">
        <p className="text-center font-bold mb-2">PAGARÉ</p>
        <p className="text-justify">
          &quot;Por el presente pagaré, reconozco deber y me comprometo incondicionalmente a pagar a la orden de 
          <strong> ABARROTES LA MANITA S.A. DE C.V.</strong> la cantidad de <strong>${datos.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })} PESOS MEXICANOS</strong>, 
          en la Ciudad de México, por haber recibido a mi entera satisfacción la mercancía descrita.
        </p>
        <p className="text-justify mt-2">
          &quot;Acepto pagar en caso de mora el 10% (diez por ciento) mensual durante el tiempo que se encuentre insoluto sin perjuicio al pago principal y sin que por esto se entienda 
          prorrogado el plazo, este pagaré es mercantil y se encuentra regido por la Ley General de Títulos y Operaciones de Créditos según Artículos 170, 171, 174 y demás artículos 
          aplicables al presente caso.
        </p>
        <div className="grid grid-cols-2 gap-8 mt-4">
          <div className="text-center">
            <div className="border-b border-black mb-1 h-8"></div>
            <p>Nombre y Firma de quien recibe</p>
          </div>
          <div className="text-center">
            <div className="border-b border-black mb-1 h-8"></div>
            <p>Fecha de recepción</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-gray-600 border-t pt-2">
        <p className="font-bold">UNA VEZ RECIBIDA LA MERCANCÍA NO SE ACEPTAN DEVOLUCIONES</p>
        {datos.notas && <p className="mt-1 italic">Notas: {datos.notas}</p>}
      </div>
    </div>
  );
};
