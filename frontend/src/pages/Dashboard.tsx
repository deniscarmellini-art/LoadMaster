import { useMemo, useState } from "react";

import ImportExcel from "../components/ImportExcel";
import DashboardGrid from "../components/dashboard/DashboardGrid";

import { creaDashboard } from "../services/dashboardService";

import type { Commessa } from "../types/excel";

function Dashboard() {

  const [commesse, setCommesse] = useState<Commessa[]>([]);

  const dashboard = useMemo(() => {
    return creaDashboard(commesse);
  }, [commesse]);

  return (

    <div style={{ padding: 20 }}>

      <h1>LoadMaster</h1>

      <ImportExcel
        onImported={(commessa) =>
          setCommesse((old) => [...old, commessa])
        }
      />

      <div style={{ height: 650 }}>

        <DashboardGrid rows={dashboard} />

      </div>

    </div>

  );

}

export default Dashboard;












































































































































































































