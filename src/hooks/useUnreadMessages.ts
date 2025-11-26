import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useUnreadMessages = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      loadUnreadCount();
      
      // Suscribirse a cambios en mensajes en tiempo real
      const channel = supabase
        .channel('unread-messages-count')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'mensajes'
          },
          () => {
            loadUnreadCount();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'conversacion_participantes'
          },
          () => {
            loadUnreadCount();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [currentUserId]);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  };

  const loadUnreadCount = async () => {
    if (!currentUserId) return;

    try {
      // Obtener todas las conversaciones del usuario
      const { data: participaciones, error: participacionesError } = await supabase
        .from("conversacion_participantes")
        .select("conversacion_id, ultimo_mensaje_leido_id")
        .eq("user_id", currentUserId);

      if (participacionesError) throw participacionesError;

      let totalUnread = 0;

      // Para cada conversación, contar mensajes no leídos
      for (const participacion of participaciones || []) {
        const { data: mensajes, error: mensajesError } = await supabase
          .from("mensajes")
          .select("id, created_at, remitente_id")
          .eq("conversacion_id", participacion.conversacion_id)
          .neq("remitente_id", currentUserId)
          .order("created_at", { ascending: true });

        if (mensajesError) throw mensajesError;

        if (mensajes && mensajes.length > 0) {
          if (!participacion.ultimo_mensaje_leido_id) {
            // Si no hay último mensaje leído, todos los mensajes son no leídos
            totalUnread += mensajes.length;
          } else {
            // Contar mensajes después del último leído
            const ultimoLeidoIndex = mensajes.findIndex(
              (m) => m.id === participacion.ultimo_mensaje_leido_id
            );
            if (ultimoLeidoIndex !== -1) {
              totalUnread += mensajes.length - ultimoLeidoIndex - 1;
            }
          }
        }
      }

      setUnreadCount(totalUnread);
    } catch (error) {
      console.error("Error al cargar mensajes no leídos:", error);
    }
  };

  return unreadCount;
};
