// Función para reproducir un sonido de notificación usando Web Audio API
export const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Crear oscilador para el tono
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Conectar nodos
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Configurar el sonido (tono agradable de notificación)
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime); // Frecuencia inicial
    oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.1); // Bajar tono
    
    // Envelope para volumen (fade in/out suave)
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    // Reproducir
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
    
    // Limpiar después de reproducir
    oscillator.onended = () => {
      audioContext.close();
    };
  } catch (error) {
    console.error('Error al reproducir sonido de notificación:', error);
  }
};
