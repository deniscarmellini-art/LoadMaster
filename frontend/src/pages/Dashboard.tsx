import { useCallback, useMemo, useState } from "react";

import DashboardContent from "../components/dashboard/DashboardContent";
import DashboardHeader from "../components/dashboard/DashboardHeader";
import DashboardKpi from "../components/dashboard/DashboardKpi";
import { creaDashboard } from "../services/dashboardService";

import type { Commessa } from "../types/excel";

function Dashboard() {
  const [commesse, setCommesse] = useState<Commessa[]>([]);

  const dashboard = useMemo(() => creaDashboard(commesse), [commesse]);

  const handleImported = useCallback((commessa: Commessa) => {
    setCommesse((currentCommesse) => [...currentCommesse, commessa]);
  }, []);

  return (
    <>
      <DashboardHeader onImported={handleImported} />
      <DashboardKpi rows={dashboard} />
      <DashboardContent rows={dashboard} />
    </>
  );
}

export default Dashboard;