import { CssBaseline, ThemeProvider } from "@mui/material";

import MainLayout from "./layouts/MainLayout";
import Dashboard from "./pages/Dashboard";
import theme from "./theme/theme";

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MainLayout>
        <Dashboard />
      </MainLayout>
    </ThemeProvider>
  );
}
