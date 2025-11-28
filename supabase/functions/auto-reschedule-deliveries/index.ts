import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Get next business day (skip Sunday only - company works Mon-Sat)
function getNextBusinessDay(date: Date): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + 1)
  
  // Only skip Sunday (day 0), Saturday (day 6) is a working day
  if (next.getDay() === 0) {
    next.setDate(next.getDate() + 1) // Move to Monday
  }
  
  return next
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]
    
    // Calculate next business day
    const nextBusinessDay = getNextBusinessDay(today)
    const nextBusinessDayStr = nextBusinessDay.toISOString().split('T')[0]

    console.log(`Running auto-reschedule check for ${todayStr}`)
    console.log(`Next business day: ${nextBusinessDayStr}`)

    // 1. Find all SCHEDULED deliveries (ordenes_compra_entregas) where fecha_programada < today
    const { data: pendingDeliveries, error: deliveriesError } = await supabase
      .from('ordenes_compra_entregas')
      .select(`
        id,
        orden_compra_id,
        numero_entrega,
        fecha_programada,
        cantidad_bultos,
        status,
        ordenes_compra (
          folio,
          proveedor_id,
          proveedores (nombre, email)
        )
      `)
      .eq('status', 'programada')
      .lt('fecha_programada', todayStr)

    if (deliveriesError) {
      throw deliveriesError
    }

    console.log(`Found ${pendingDeliveries?.length || 0} overdue scheduled deliveries`)

    // 2. Find orders with single delivery (no entregas_multiples) that are overdue
    const { data: pendingOrders, error: ordersError } = await supabase
      .from('ordenes_compra')
      .select(`
        id,
        folio,
        fecha_entrega_programada,
        status,
        entregas_multiples,
        notas,
        proveedor_id,
        proveedores (nombre, email)
      `)
      .in('status', ['enviada', 'confirmada', 'parcial'])
      .eq('entregas_multiples', false)
      .lt('fecha_entrega_programada', todayStr)
      .not('fecha_entrega_programada', 'is', null)

    if (ordersError) {
      throw ordersError
    }

    console.log(`Found ${pendingOrders?.length || 0} overdue single-delivery orders`)

    const rescheduledItems: any[] = []

    // 3. Reschedule overdue multi-delivery entries
    for (const delivery of (pendingDeliveries || [])) {
      const { error: updateError } = await supabase
        .from('ordenes_compra_entregas')
        .update({ 
          fecha_programada: nextBusinessDayStr,
          notas: `[AUTO] Reprogramada de ${delivery.fecha_programada} a ${nextBusinessDayStr} por no recepción`
        })
        .eq('id', delivery.id)

      if (!updateError) {
        const ordenData = delivery.ordenes_compra as any
        const proveedorData = ordenData?.proveedores as any
        
        rescheduledItems.push({
          type: 'entrega_multiple',
          folio: ordenData?.folio,
          proveedor: proveedorData?.nombre,
          proveedor_email: proveedorData?.email,
          numero_entrega: delivery.numero_entrega,
          fecha_original: delivery.fecha_programada,
          fecha_nueva: nextBusinessDayStr,
          cantidad_bultos: delivery.cantidad_bultos
        })
      }
    }

    // 4. Reschedule overdue single-delivery orders
    for (const order of (pendingOrders || [])) {
      const currentNotas = (order as any).notas || ''
      const proveedorData = (order as any).proveedores as any
      
      const { error: updateError } = await supabase
        .from('ordenes_compra')
        .update({ 
          fecha_entrega_programada: nextBusinessDayStr,
          notas: currentNotas 
            ? `${currentNotas}\n[AUTO ${todayStr}] Reprogramada de ${order.fecha_entrega_programada} a ${nextBusinessDayStr} por no recepción`
            : `[AUTO ${todayStr}] Reprogramada de ${order.fecha_entrega_programada} a ${nextBusinessDayStr} por no recepción`
        })
        .eq('id', order.id)

      if (!updateError) {
        rescheduledItems.push({
          type: 'orden_simple',
          folio: order.folio,
          proveedor: proveedorData?.nombre,
          proveedor_email: proveedorData?.email,
          fecha_original: order.fecha_entrega_programada,
          fecha_nueva: nextBusinessDayStr
        })
      }
    }

    // 5. Create notifications for rescheduled items
    if (rescheduledItems.length > 0) {
      const notificaciones = rescheduledItems.map(item => ({
        tipo: 'entrega_reprogramada',
        titulo: `Entrega reprogramada: ${item.folio}`,
        descripcion: `La entrega de ${item.proveedor} programada para ${new Date(item.fecha_original).toLocaleDateString('es-MX')} fue reprogramada automáticamente para ${new Date(item.fecha_nueva).toLocaleDateString('es-MX')} por no recepción.`,
        leida: false
      }))

      await supabase
        .from('notificaciones')
        .insert(notificaciones)

      // 6. Optionally send email notifications to suppliers with email
      for (const item of rescheduledItems) {
        if (item.proveedor_email) {
          try {
            await supabase.functions.invoke('gmail-api', {
              body: {
                action: 'send',
                email: 'compras@almasa.com.mx',
                to: item.proveedor_email,
                subject: `Entrega reprogramada - ${item.folio}`,
                body: `
                  <div style="font-family: Arial, sans-serif;">
                    <h2>Notificación de Reprogramación</h2>
                    <p>Le informamos que la entrega programada para el <strong>${new Date(item.fecha_original).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</strong> de la orden <strong>${item.folio}</strong> no fue recibida.</p>
                    <p>La entrega ha sido reprogramada automáticamente para el <strong>${new Date(item.fecha_nueva).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>.</p>
                    <p>Por favor confirme la nueva fecha de entrega.</p>
                    <hr>
                    <p style="color: #666; font-size: 12px;">Abarrotes La Manita - Sistema ERP</p>
                  </div>
                `
              }
            })
          } catch (emailError) {
            console.error(`Error sending email to ${item.proveedor_email}:`, emailError)
          }
        }
      }
    }

    console.log(`Rescheduled ${rescheduledItems.length} deliveries`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${rescheduledItems.length} overdue deliveries`,
        rescheduled: rescheduledItems
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error: any) {
    console.error('Error in auto-reschedule:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
