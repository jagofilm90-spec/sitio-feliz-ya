import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Verificar autenticación del usuario que llama
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Verificar que el usuario tiene rol de admin o secretaria
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'secretaria'])

    if (rolesError || !roles || roles.length === 0) {
      throw new Error('No tienes permisos para crear usuarios de clientes')
    }

    // Obtener datos del nuevo usuario cliente
    const { email, password, cliente_id, nombre_cliente } = await req.json()

    if (!email || !password || !cliente_id) {
      throw new Error('Faltan campos requeridos: email, password, cliente_id')
    }

    // Verificar que el cliente existe y no tiene user_id
    const { data: cliente, error: clienteError } = await supabaseAdmin
      .from('clientes')
      .select('id, nombre, user_id')
      .eq('id', cliente_id)
      .single()

    if (clienteError || !cliente) {
      throw new Error('Cliente no encontrado')
    }

    if (cliente.user_id) {
      throw new Error('Este cliente ya tiene una cuenta de acceso vinculada')
    }

    // Crear usuario usando admin API
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirmar email
      user_metadata: {
        full_name: nombre_cliente || cliente.nombre
      }
    })

    if (createError) {
      if (createError.message.includes('already been registered')) {
        throw new Error('Este correo ya está registrado en el sistema')
      }
      throw createError
    }

    if (!newUser.user) {
      throw new Error('Error al crear usuario')
    }

    // Asignar rol de cliente
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: newUser.user.id,
        role: 'cliente'
      })

    if (roleError) {
      // Rollback: eliminar usuario si falla el rol
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
      throw new Error('Error al asignar rol de cliente')
    }

    // Vincular usuario al cliente
    const { error: linkError } = await supabaseAdmin
      .from('clientes')
      .update({ user_id: newUser.user.id })
      .eq('id', cliente_id)

    if (linkError) {
      // Rollback: eliminar usuario y rol si falla el vínculo
      await supabaseAdmin.from('user_roles').delete().eq('user_id', newUser.user.id)
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
      throw new Error('Error al vincular usuario con cliente')
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUser.user.id,
          email: newUser.user.email
        },
        message: `Cuenta creada para ${cliente.nombre}. El cliente puede acceder con: ${email}`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    return new Response(
      JSON.stringify({
        error: errorMessage
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
