import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Send, Users, Plus, Search, Trash2, Paperclip, X, FileText, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";
import { playNotificationSound } from "@/utils/notificationSound";

interface Conversation {
  id: string;
  tipo: "individual" | "grupo_personalizado" | "grupo_puesto" | "broadcast";
  nombre: string | null;
  puesto: string | null;
  created_at: string;
  updated_at: string;
  ultimo_mensaje?: {
    contenido: string;
    created_at: string;
  };
  mensajes_no_leidos: number;
  participantes?: UserProfile[];
}

interface Message {
  id: string;
  conversacion_id: string;
  remitente_id: string | null;
  contenido: string;
  created_at: string;
  remitente?: UserProfile;
  archivo_url?: string | null;
  archivo_nombre?: string | null;
  archivo_tipo?: string | null;
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
}

const Chat = () => {
  const [conversaciones, setConversaciones] = useState<Conversation[]>([]);
  const [conversacionActiva, setConversacionActiva] = useState<Conversation | null>(null);
  const [mensajes, setMensajes] = useState<Message[]>([]);
  const [nuevoMensaje, setNuevoMensaje] = useState("");
  const [usuarios, setUsuarios] = useState<UserProfile[]>([]);
  const [usuariosSeleccionados, setUsuariosSeleccionados] = useState<string[]>([]);
  const [tipoGrupo, setTipoGrupo] = useState<"individual" | "grupo_personalizado" | "grupo_puesto" | "broadcast">("individual");
  const [nombreGrupo, setNombreGrupo] = useState("");
  const [puestoGrupo, setPuestoGrupo] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [usuariosEnLinea, setUsuariosEnLinea] = useState<Set<string>>(new Set());
  const [ultimoMensajeLeidoOtroUsuario, setUltimoMensajeLeidoOtroUsuario] = useState<string | null>(null);
  const [archivoSeleccionado, setArchivoSeleccionado] = useState<File | null>(null);
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadCurrentUser();
    loadUsuarios();
  }, []);

  // Cargar conversaciones solo cuando currentUserId esté disponible
  useEffect(() => {
    if (currentUserId) {
      loadConversaciones();
      setupPresence();
    }
  }, [currentUserId]);

  const setupPresence = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const onlineUsers = new Set<string>();
        
        Object.keys(state).forEach((userId) => {
          onlineUsers.add(userId);
        });
        
        setUsuariosEnLinea(onlineUsers);
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        setUsuariosEnLinea((prev) => new Set([...prev, key]));
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setUsuariosEnLinea((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  };

  useEffect(() => {
    if (conversacionActiva) {
      loadMensajes(conversacionActiva.id);
      marcarComoLeido(conversacionActiva.id);

      // Suscribirse a nuevos mensajes en tiempo real para la conversación activa
      const mensajesChannel = supabase
        .channel('mensajes-realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'mensajes',
            filter: `conversacion_id=eq.${conversacionActiva.id}`,
          },
          async (payload) => {
            const nuevoMensaje = payload.new as Message;

            // Cargar datos del remitente
            const { data: remitente } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .eq('id', nuevoMensaje.remitente_id)
              .single();

            setMensajes((prev) => [...prev, { ...nuevoMensaje, remitente }]);
            marcarComoLeido(conversacionActiva.id);
            
            // Si es chat individual, actualizar el estado de visto del otro usuario
            if (conversacionActiva.tipo === 'individual' && nuevoMensaje.remitente_id !== currentUserId) {
              setUltimoMensajeLeidoOtroUsuario(nuevoMensaje.id);
            }
          }
        )
        .subscribe();

      // Suscribirse a cambios en conversacion_participantes para actualizar el estado "visto"
      const participantesChannel = supabase
        .channel('participantes-realtime')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'conversacion_participantes',
            filter: `conversacion_id=eq.${conversacionActiva.id}`,
          },
          async (payload) => {
            // Si el otro usuario actualizó su último mensaje leído, actualizar nuestro estado
            if (conversacionActiva.tipo === 'individual' && payload.new.user_id !== currentUserId) {
              setUltimoMensajeLeidoOtroUsuario(payload.new.ultimo_mensaje_leido_id);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(mensajesChannel);
        supabase.removeChannel(participantesChannel);
      };
    }
  }, [conversacionActiva, currentUserId]);

  // Notificaciones en tiempo real para conversaciones inactivas
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel('mensajes-notificaciones')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensajes',
        },
        async (payload) => {
          const nuevoMensaje = payload.new as Message;

          // Ignorar mensajes propios o de la conversación actualmente abierta
          if (
            nuevoMensaje.remitente_id === currentUserId ||
            (conversacionActiva && nuevoMensaje.conversacion_id === conversacionActiva.id)
          ) {
            return;
          }

          const conv = conversaciones.find((c) => c.id === nuevoMensaje.conversacion_id);
          
          // Obtener nombre del remitente para grupos
          let nombreRemitente = 'Usuario';
          if (nuevoMensaje.remitente_id) {
            const { data: remitente } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', nuevoMensaje.remitente_id)
              .single();
            
            if (remitente) {
              nombreRemitente = remitente.full_name;
            }
          }

          let titulo = 'Nuevo mensaje';
          let descripcion = nuevoMensaje.contenido.length > 80
            ? `${nuevoMensaje.contenido.slice(0, 77)}...`
            : nuevoMensaje.contenido;

          if (conv) {
            const nombreConv = getNombreConversacion(conv);
            
            if (conv.tipo === 'individual') {
              titulo = `Mensaje de ${nombreConv}`;
            } else if (conv.tipo === 'grupo_puesto') {
              titulo = `💬 ${nombreConv}`;
              descripcion = `${nombreRemitente}: ${descripcion}`;
            } else if (conv.tipo === 'broadcast') {
              titulo = `📢 Mensaje para todos`;
              descripcion = `${nombreRemitente}: ${descripcion}`;
            }
          }

          // Reproducir sonido de notificación
          playNotificationSound();

          toast({
            title: titulo,
            description: descripcion,
          });

          // Refrescar lista de conversaciones para actualizar contadores
          loadConversaciones();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, conversacionActiva, conversaciones]);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const loadUsuarios = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name');

      if (error) throw error;
      setUsuarios(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const loadConversaciones = async () => {
    if (!currentUserId) {
      console.log("No se puede cargar conversaciones sin currentUserId");
      return;
    }
    
    try {
      const { data: conversacionesData, error } = await supabase
        .from('conversaciones')
        .select(`
          *,
          conversacion_participantes!inner(user_id)
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Cargar último mensaje y contar no leídos para cada conversación
      const conversacionesConDetalles = await Promise.all(
        (conversacionesData || []).map(async (conv) => {
          // Último mensaje
          const { data: ultimoMensaje } = await supabase
            .from('mensajes')
            .select('contenido, created_at')
            .eq('conversacion_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          // Mensajes no leídos
          const { data: participante } = await supabase
            .from('conversacion_participantes')
            .select('ultimo_mensaje_leido_id')
            .eq('conversacion_id', conv.id)
            .eq('user_id', currentUserId)
            .single();

          let mensajesNoLeidos = 0;
          if (participante) {
            if (!participante.ultimo_mensaje_leido_id) {
              // Si no hay último mensaje leído, contar todos los mensajes que no sean del usuario actual
              const { count } = await supabase
                .from('mensajes')
                .select('id', { count: 'exact', head: true })
                .eq('conversacion_id', conv.id)
                .neq('remitente_id', currentUserId);
              
              mensajesNoLeidos = count || 0;
            } else {
              // Obtener la fecha del último mensaje leído
              const { data: ultimoMensajeLeido } = await supabase
                .from('mensajes')
                .select('created_at')
                .eq('id', participante.ultimo_mensaje_leido_id)
                .single();
              
              if (ultimoMensajeLeido) {
                // Contar mensajes después del último leído
                const { count } = await supabase
                  .from('mensajes')
                  .select('id', { count: 'exact', head: true })
                  .eq('conversacion_id', conv.id)
                  .gt('created_at', ultimoMensajeLeido.created_at)
                  .neq('remitente_id', currentUserId);
                
                mensajesNoLeidos = count || 0;
              }
            }
          }

          // Cargar participantes para todas las conversaciones
          let participantes: UserProfile[] = [];
          const { data: participantesData } = await supabase
            .from('conversacion_participantes')
            .select('user_id')
            .eq('conversacion_id', conv.id);

          if (participantesData) {
            const userIds = participantesData.map(p => p.user_id);
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .in('id', userIds);
            
            participantes = profiles || [];
          }

          return {
            ...conv,
            ultimo_mensaje: ultimoMensaje,
            mensajes_no_leidos: mensajesNoLeidos,
            participantes,
          };
        })
      );

      setConversaciones(conversacionesConDetalles);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const loadMensajes = async (conversacionId: string) => {
    try {
      const { data: mensajesData, error } = await supabase
        .from('mensajes')
        .select('*')
        .eq('conversacion_id', conversacionId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Cargar datos de los remitentes
      if (mensajesData && mensajesData.length > 0) {
        const remitentesIds = [...new Set(mensajesData.map(m => m.remitente_id).filter(Boolean))];
        
        const { data: remitentes } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', remitentesIds);

        const remitentesMap = new Map(remitentes?.map(r => [r.id, r]) || []);

        const mensajesConRemitente = mensajesData.map(mensaje => ({
          ...mensaje,
          remitente: mensaje.remitente_id ? remitentesMap.get(mensaje.remitente_id) : undefined
        }));

        setMensajes(mensajesConRemitente);
        
        // Para chats individuales, cargar el último mensaje leído del otro usuario
        if (conversacionActiva?.tipo === 'individual') {
          const otroUsuarioId = conversacionActiva.participantes?.find(p => p.id !== currentUserId)?.id;
          
          if (otroUsuarioId) {
            const { data: participanteData } = await supabase
              .from('conversacion_participantes')
              .select('ultimo_mensaje_leido_id')
              .eq('conversacion_id', conversacionId)
              .eq('user_id', otroUsuarioId)
              .single();

            setUltimoMensajeLeidoOtroUsuario(participanteData?.ultimo_mensaje_leido_id || null);
          }
        }
      } else {
        setMensajes([]);
        setUltimoMensajeLeidoOtroUsuario(null);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const marcarComoLeido = async (conversacionId: string) => {
    try {
      const { data: ultimoMensaje } = await supabase
        .from('mensajes')
        .select('id')
        .eq('conversacion_id', conversacionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (ultimoMensaje) {
        await supabase
          .from('conversacion_participantes')
          .update({ ultimo_mensaje_leido_id: ultimoMensaje.id })
          .eq('conversacion_id', conversacionId)
          .eq('user_id', currentUserId);
        
        // Actualizar el último mensaje leído localmente si es chat individual
        if (conversacionActiva?.tipo === 'individual') {
          setUltimoMensajeLeidoOtroUsuario(ultimoMensaje.id);
        }
      }

      loadConversaciones();
    } catch (error: any) {
      console.error('Error marcando como leído:', error);
    }
  };

  const crearConversacion = async () => {
    try {
      // Verificar sesión y autenticación
      const { data: { session } } = await supabase.auth.getSession();

      if (!session || !currentUserId) {
        toast({
          title: "Error de autenticación",
          description: "No hay una sesión válida. Por favor recarga la página.",
          variant: "destructive",
        });
        return;
      }

      if (tipoGrupo === 'individual' && usuariosSeleccionados.length !== 1) {
        toast({
          title: "Error",
          description: "Selecciona exactamente un usuario para chat individual",
          variant: "destructive",
        });
        return;
      }

      // Para chats individuales, verificar si ya existe una conversación con este usuario
      if (tipoGrupo === 'individual') {
        const otroUsuarioId = usuariosSeleccionados[0];
        
        // Buscar conversación existente con este usuario
        const conversacionExistente = conversaciones.find(conv => {
          if (conv.tipo !== 'individual') return false;
          
          const participantesIds = conv.participantes?.map(p => p.id) || [];
          return participantesIds.includes(currentUserId!) && 
                 participantesIds.includes(otroUsuarioId) &&
                 participantesIds.length === 2;
        });

        if (conversacionExistente) {
          // Ya existe una conversación, abrirla en vez de crear una nueva
          setConversacionActiva(conversacionExistente);
          setShowNewConversation(false);
          setUsuariosSeleccionados([]);
          toast({
            title: "Chat existente",
            description: "Ya tienes una conversación con este usuario",
          });
          return;
        }
      }

      if (tipoGrupo === 'grupo_puesto' && !puestoGrupo) {
        toast({
          title: "Error",
          description: "Selecciona un puesto",
          variant: "destructive",
        });
        return;
      }

      // Crear conversación
      const { data: nuevaConv, error: convError } = await supabase
        .from('conversaciones')
        .insert({
          tipo: tipoGrupo,
          nombre: null,
          puesto: tipoGrupo === 'grupo_puesto' ? puestoGrupo : null,
          creado_por: currentUserId,
        })
        .select()
        .single();

      if (convError) throw convError;

      // Agregar participantes
      let participantesIds = [...usuariosSeleccionados];

      if (tipoGrupo === 'grupo_puesto') {
        // Obtener todos los empleados con ese puesto
        const { data: empleados } = await supabase
          .from('empleados')
          .select('user_id')
          .eq('puesto', puestoGrupo)
          .not('user_id', 'is', null);

        participantesIds = empleados?.map(e => e.user_id!).filter(Boolean) || [];
      } else if (tipoGrupo === 'broadcast') {
        // Agregar todos los usuarios
        participantesIds = usuarios.map(u => u.id);
      }

      // Agregar al creador si no está en la lista
      if (!participantesIds.includes(currentUserId!)) {
        participantesIds.push(currentUserId!);
      }

      const participantes = participantesIds.map(userId => ({
        conversacion_id: nuevaConv.id,
        user_id: userId,
      }));

      const { error: partError } = await supabase
        .from('conversacion_participantes')
        .insert(participantes);

      if (partError) throw partError;

      toast({
        title: "Conversación creada",
        description: "La conversación se creó correctamente",
      });

      setShowNewConversation(false);
      setUsuariosSeleccionados([]);
      setNombreGrupo("");
      setPuestoGrupo("");
      loadConversaciones();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const enviarMensaje = async () => {
    if ((!nuevoMensaje.trim() && !archivoSeleccionado) || !conversacionActiva) return;

    try {
      setSubiendoArchivo(true);
      
      let archivoUrl = null;
      let archivoNombre = null;
      let archivoTipo = null;

      // Si hay un archivo seleccionado, subirlo primero
      if (archivoSeleccionado) {
        const fileExt = archivoSeleccionado.name.split('.').pop();
        const fileName = `${currentUserId}/${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('chat-archivos')
          .upload(fileName, archivoSeleccionado, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        // Obtener URL pública del archivo
        const { data: { publicUrl } } = supabase.storage
          .from('chat-archivos')
          .getPublicUrl(fileName);

        archivoUrl = publicUrl;
        archivoNombre = archivoSeleccionado.name;
        archivoTipo = archivoSeleccionado.type;
      }

      const { error } = await supabase
        .from('mensajes')
        .insert({
          conversacion_id: conversacionActiva.id,
          remitente_id: currentUserId,
          contenido: nuevoMensaje.trim() || (archivoNombre ? `📎 ${archivoNombre}` : ''),
          archivo_url: archivoUrl,
          archivo_nombre: archivoNombre,
          archivo_tipo: archivoTipo,
        });

      if (error) throw error;

      // Actualizar updated_at de la conversación
      await supabase
        .from('conversaciones')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversacionActiva.id);

      setNuevoMensaje("");
      setArchivoSeleccionado(null);
      loadConversaciones();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubiendoArchivo(false);
    }
  };

  const getNombreConversacion = (conv: Conversation) => {
    if (conv.nombre) return conv.nombre;
    if (conv.tipo === 'grupo_puesto') return `Grupo: ${conv.puesto}`;
    if (conv.tipo === 'broadcast') return 'Todos los usuarios';
    
    // Para chat individual, mostrar el nombre del otro usuario
    if (conv.tipo === 'individual') {
      if (!currentUserId) {
        return 'Cargando...';
      }
      
      if (!conv.participantes || conv.participantes.length === 0) {
        return 'Chat individual';
      }

      const otroUsuario = conv.participantes.find(p => p.id !== currentUserId);
      
      if (otroUsuario) {
        return otroUsuario.full_name;
      }
    }
    
    return 'Chat individual';
  };

  const getUsuarioEnLineaDeConversacion = (conv: Conversation): boolean => {
    if (conv.tipo !== 'individual') return false;
    
    // Buscar el usuario del chat individual (el que no es el usuario actual)
    const otroUsuarioId = conv.participantes?.find(p => p.id !== currentUserId)?.id;
    return otroUsuarioId ? usuariosEnLinea.has(otroUsuarioId) : false;
  };

  const esMensajeVisto = (mensaje: Message): boolean => {
    // Solo aplica para mensajes propios en chats individuales
    if (conversacionActiva?.tipo !== 'individual' || mensaje.remitente_id !== currentUserId) {
      return false;
    }
    
    if (!ultimoMensajeLeidoOtroUsuario) return false;
    
    // Verificar si este mensaje fue leído comparando con el último mensaje leído del otro usuario
    const indiceMensajeActual = mensajes.findIndex(m => m.id === mensaje.id);
    const indiceUltimoLeido = mensajes.findIndex(m => m.id === ultimoMensajeLeidoOtroUsuario);
    
    return indiceUltimoLeido >= indiceMensajeActual && indiceUltimoLeido !== -1;
  };

  const eliminarConversacion = async (conversacionId: string) => {
    try {
      // Primero eliminar participantes
      const { error: partError } = await supabase
        .from('conversacion_participantes')
        .delete()
        .eq('conversacion_id', conversacionId);

      if (partError) throw partError;

      // Luego eliminar mensajes
      const { error: mensajesError } = await supabase
        .from('mensajes')
        .delete()
        .eq('conversacion_id', conversacionId);

      if (mensajesError) throw mensajesError;

      // Finalmente eliminar la conversación
      const { error: convError } = await supabase
        .from('conversaciones')
        .delete()
        .eq('id', conversacionId);

      if (convError) throw convError;

      toast({
        title: "Conversación eliminada",
        description: "La conversación se eliminó correctamente",
      });

      // Si era la conversación activa, limpiarla
      if (conversacionActiva?.id === conversacionId) {
        setConversacionActiva(null);
      }

      loadConversaciones();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredConversaciones = conversaciones.filter((conv) =>
    getNombreConversacion(conv).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar de conversaciones */}
        <div className="w-80 border-r flex flex-col">
          <div className="p-4 border-b space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Mensajes</h2>
              <Dialog open={showNewConversation} onOpenChange={setShowNewConversation}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Nuevo
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                   <DialogHeader>
                    <DialogTitle>Nueva Conversación</DialogTitle>
                    <DialogDescription>
                      Crea un chat individual, grupo por puesto o mensaje para todos
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    <div>
                      <Label>Tipo de conversación</Label>
                      <Select value={tipoGrupo} onValueChange={(v: any) => setTipoGrupo(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="individual">Chat Individual</SelectItem>
                          <SelectItem value="grupo_puesto">Grupo por Puesto</SelectItem>
                          <SelectItem value="broadcast">Mensaje a Todos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>


                    {tipoGrupo === 'grupo_puesto' && (
                      <div>
                        <Label>Selecciona el puesto</Label>
                        <Select value={puestoGrupo} onValueChange={setPuestoGrupo}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar puesto" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Secretaria">Secretarias</SelectItem>
                            <SelectItem value="Vendedor">Vendedores</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {tipoGrupo === 'individual' && (
                      <div>
                        <Label>Selecciona usuarios</Label>
                        <ScrollArea className="h-64 border rounded-md p-3">
                          <div className="space-y-2">
                            {usuarios.map((usuario) => (
                              <div key={usuario.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={usuario.id}
                                  checked={usuariosSeleccionados.includes(usuario.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setUsuariosSeleccionados([...usuariosSeleccionados, usuario.id]);
                                    } else {
                                      setUsuariosSeleccionados(
                                        usuariosSeleccionados.filter((id) => id !== usuario.id)
                                      );
                                    }
                                  }}
                                />
                                <Label htmlFor={usuario.id} className="font-normal cursor-pointer">
                                  {usuario.full_name}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}

                    {tipoGrupo === 'individual' && (
                      <div className="bg-muted p-3 rounded-md mb-3">
                        <p className="text-sm font-medium mb-2">Usuarios en línea:</p>
                        <div className="flex flex-wrap gap-2">
                          {usuarios
                            .filter(u => usuariosEnLinea.has(u.id))
                            .map(u => (
                              <Badge key={u.id} variant="secondary" className="flex items-center gap-1">
                                <div className="w-2 h-2 bg-green-500 rounded-full" />
                                {u.full_name}
                              </Badge>
                            ))}
                          {usuarios.filter(u => usuariosEnLinea.has(u.id)).length === 0 && (
                            <p className="text-sm text-muted-foreground">Ningún usuario en línea</p>
                          )}
                        </div>
                      </div>
                    )}

                    {tipoGrupo === 'broadcast' && (
                      <div className="bg-muted p-3 rounded-md">
                        <p className="text-sm text-muted-foreground">
                          El mensaje será enviado a todos los usuarios del sistema
                        </p>
                      </div>
                    )}

                    <Button onClick={crearConversacion} className="w-full">
                      Crear Conversación
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar conversaciones..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            {filteredConversaciones.map((conv) => (
              <Card
                key={conv.id}
                className={`m-2 p-3 cursor-pointer hover:bg-accent transition-colors ${
                  conversacionActiva?.id === conv.id ? 'bg-accent' : ''
                }`}
                onClick={() => setConversacionActiva(conv)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className="relative">
                      <Avatar>
                        <AvatarFallback>
                          {conv.tipo === 'individual' ? <MessageCircle className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                        </AvatarFallback>
                      </Avatar>
                      {getUsuarioEnLineaDeConversacion(conv) && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium truncate">{getNombreConversacion(conv)}</p>
                        <div className="flex items-center gap-1">
                          {conv.mensajes_no_leidos > 0 && (
                            <Badge variant="default" className="ml-2">
                              {conv.mensajes_no_leidos}
                            </Badge>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar conversación?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción no se puede deshacer. Se eliminarán todos los mensajes de esta conversación.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => eliminarConversacion(conv.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                      {conv.ultimo_mensaje && (
                        <p className="text-sm text-muted-foreground truncate">
                          {conv.ultimo_mensaje.contenido}
                        </p>
                      )}
                      {conv.ultimo_mensaje && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(conv.ultimo_mensaje.created_at), 'dd/MM/yyyy HH:mm')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </ScrollArea>
        </div>

        {/* Área de mensajes */}
        <div className="flex-1 flex flex-col">
          {conversacionActiva ? (
            <>
              {/* Header del chat */}
              <div className="p-4 border-b">
                <h3 className="font-bold">{getNombreConversacion(conversacionActiva)}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-sm text-muted-foreground">
                    {conversacionActiva.tipo === 'broadcast' && 'Mensaje para todos los usuarios'}
                    {conversacionActiva.tipo === 'grupo_puesto' && `Grupo de ${conversacionActiva.puesto}`}
                    {conversacionActiva.tipo === 'individual' && 'Chat individual'}
                  </p>
                  
                  {/* Mostrar usuarios en línea para grupos */}
                  {(conversacionActiva.tipo === 'grupo_puesto' || conversacionActiva.tipo === 'broadcast') && (
                    <div className="flex items-center gap-1 ml-auto">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="text-xs text-muted-foreground">
                        {conversacionActiva.participantes?.filter(p => usuariosEnLinea.has(p.id)).length || 0} en línea
                      </span>
                    </div>
                  )}
                  
                  {/* Indicador en línea para chat individual */}
                  {conversacionActiva.tipo === 'individual' && getUsuarioEnLineaDeConversacion(conversacionActiva) && (
                    <div className="flex items-center gap-1 ml-auto">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="text-xs text-green-600">En línea</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Mensajes */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {mensajes.map((mensaje) => {
                    const esMio = mensaje.remitente_id === currentUserId;
                    return (
                      <div
                        key={mensaje.id}
                        className={`flex ${esMio ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[70%] ${esMio ? 'order-2' : 'order-1'}`}>
                          {!esMio && (
                            <p className="text-xs font-medium mb-1 text-muted-foreground">
                              {mensaje.remitente?.full_name || 'Usuario'}
                            </p>
                          )}
                          <div
                            className={`rounded-lg p-3 ${
                              esMio
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            }`}
                          >
                            {/* Mostrar archivo adjunto si existe */}
                            {mensaje.archivo_url && (
                              <div className="mb-2">
                                {mensaje.archivo_tipo?.startsWith('image/') ? (
                                  <a 
                                    href={mensaje.archivo_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="block"
                                  >
                                    <img 
                                      src={mensaje.archivo_url} 
                                      alt={mensaje.archivo_nombre || 'Imagen'} 
                                      className="max-w-xs rounded-md cursor-pointer hover:opacity-90 transition-opacity"
                                    />
                                  </a>
                                ) : (
                                  <a
                                    href={mensaje.archivo_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`flex items-center gap-2 p-2 rounded border ${
                                      esMio 
                                        ? 'border-primary-foreground/20 hover:bg-primary-foreground/10' 
                                        : 'border-border hover:bg-accent'
                                    } transition-colors`}
                                  >
                                    <FileText className="h-5 w-5" />
                                    <span className="text-sm truncate max-w-[200px]">
                                      {mensaje.archivo_nombre || 'Archivo'}
                                    </span>
                                  </a>
                                )}
                              </div>
                            )}
                            
                            {mensaje.contenido && <p>{mensaje.contenido}</p>}
                            
                            <div className="flex items-center justify-between gap-2 mt-1">
                              <p className={`text-xs ${esMio ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                {format(new Date(mensaje.created_at), 'HH:mm')}
                              </p>
                              {esMio && conversacionActiva?.tipo === 'individual' && (
                                <span className={`text-xs ${esMio ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                  {esMensajeVisto(mensaje) ? '✓✓' : '✓'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              {/* Input de mensaje */}
              <div className="p-4 border-t">
                {/* Mostrar archivo seleccionado */}
                {archivoSeleccionado && (
                  <div className="mb-2 flex items-center gap-2 p-2 bg-muted rounded-md">
                    {archivoSeleccionado.type.startsWith('image/') ? (
                      <ImageIcon className="h-4 w-4" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                    <span className="text-sm truncate flex-1">{archivoSeleccionado.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setArchivoSeleccionado(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                
                <div className="flex space-x-2">
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        // Validar tamaño (máximo 10MB)
                        if (file.size > 10 * 1024 * 1024) {
                          toast({
                            title: "Archivo muy grande",
                            description: "El archivo no debe superar 10MB",
                            variant: "destructive",
                          });
                          return;
                        }
                        setArchivoSeleccionado(file);
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => document.getElementById('file-upload')?.click()}
                    disabled={subiendoArchivo}
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Input
                    value={nuevoMensaje}
                    onChange={(e) => setNuevoMensaje(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        enviarMensaje();
                      }
                    }}
                    placeholder="Escribe un mensaje..."
                    disabled={subiendoArchivo}
                  />
                  <Button 
                    onClick={enviarMensaje} 
                    disabled={(!nuevoMensaje.trim() && !archivoSeleccionado) || subiendoArchivo}
                  >
                    {subiendoArchivo ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Selecciona una conversación para comenzar</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Chat;