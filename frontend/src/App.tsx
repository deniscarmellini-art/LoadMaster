import { Box, Typography } from "@mui/material";

function App() {
  return (
    <Box
      sx={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        bgcolor: "background.default",
      }}
    >
      <Box textAlign="center">
        <Typography variant="h3" color="primary" fontWeight="bold">
          🚛 LOADMASTER
        </Typography>

        <Typography variant="h6" sx={{ mt: 2 }}>
          Warehouse Management System
        </Typography>
      </Box>
    </Box>
  );
}

export default App;