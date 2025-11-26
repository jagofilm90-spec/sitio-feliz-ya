import { Card } from "@/components/ui/card";

const CalendarioEntregasTab = () => {
  return (
    <Card className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Calendario de Entregas</h2>
        <p className="text-muted-foreground">
          Visualiza y gestiona las entregas programadas de tus proveedores
        </p>
      </div>

      <div className="text-center py-12 text-muted-foreground">
        Calendario de entregas en desarrollo
      </div>
    </Card>
  );
};

export default CalendarioEntregasTab;
