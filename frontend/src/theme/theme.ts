import { createTheme } from "@mui/material/styles";

export const dashboardColors = {
  card: "#131b25",
  surface: "#121922",
  grid: "#10161e",
  search: "#1a2430",
  header: "#24313f",
  stripe: "rgba(255,255,255,0.018)",
  rowHover: "rgba(72,137,201,0.075)",
  rowSelected: "rgba(72,137,201,0.13)",
  rowSelectedHover: "rgba(82,147,211,0.17)",
  divider: "rgba(255,255,255,0.12)",
  subtleText: "rgba(160,168,181,0.72)",
} as const;

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#1976d2" },
    secondary: { main: "#4caf50" },
    background: { default: "#0b0f14", paper: "#141a22" },
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: 'Inter, "Segoe UI", Roboto, Arial, sans-serif',
    h4: { fontWeight: 800 },
    h5: { fontWeight: 700 },
  },
  components: {
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiCard: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 10, fontWeight: 700, textTransform: "none" },
      },
    },
  },
});

export default theme;
