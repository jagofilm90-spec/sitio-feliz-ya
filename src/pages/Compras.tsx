import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Layout from "@/components/Layout";
import { Package, Truck, Calendar } from "lucide-react";
import ProveedoresTab from "@/components/compras/ProveedoresTab";
import OrdenesCompraTab from "@/components/compras/OrdenesCompraTab";
import CalendarioEntregasTab from "@/components/compras/CalendarioEntregasTab";

const Compras = () => {
  const [activeTab, setActiveTab] = useState("proveedores");

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Compras</h1>
          <p className="text-muted-foreground">
            Gestión de proveedores, órdenes de compra y calendario de entregas
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="proveedores" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Proveedores
            </TabsTrigger>
            <TabsTrigger value="ordenes" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Órdenes de Compra
            </TabsTrigger>
            <TabsTrigger value="calendario" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Calendario de Entregas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="proveedores">
            <ProveedoresTab />
          </TabsContent>

          <TabsContent value="ordenes">
            <OrdenesCompraTab />
          </TabsContent>

          <TabsContent value="calendario">
            <CalendarioEntregasTab />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Compras;
