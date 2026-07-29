import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#ff3b30",
    },
    secondary: {
      main: "#4caf50",
    },
    background: {
      default: "#111418",
      paper: "#1b2027",
    },
  },

  shape: {
    borderRadius: 10,
  },

  typography: {
    fontFamily: "Segoe UI, Roboto, Arial",
    h4: {
      fontWeight: 700,
    },
    h5: {
      fontWeight: 600,
    },
  },
});

export default theme;