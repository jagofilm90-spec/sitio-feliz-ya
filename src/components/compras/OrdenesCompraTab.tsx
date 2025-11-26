import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const OrdenesCompraTab = () => {
  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">Órdenes de Compra</h2>
          <p className="text-muted-foreground">
            Gestiona tus órdenes de compra y recepciones
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Orden de Compra
        </Button>
      </div>

      <div className="text-center py-12 text-muted-foreground">
        Funcionalidad de órdenes de compra en desarrollo
      </div>
    </Card>
  );
};

export default OrdenesCompraTab;
