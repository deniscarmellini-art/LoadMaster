import { Box, Container, Typography } from "@mui/material";

type Props = {
  children: React.ReactNode;
};

export default function MainLayout({ children }: Props) {
  return (
    <Box sx={{ minHeight: "100vh" }}>
      <Box component="main" sx={{ py: { xs: 1.5, md: 2.5 } }}>
        <Container maxWidth={false} sx={{ px: { xs: 1.5, md: 3 } }}>{children}</Container>
      </Box>
      <Box component="footer" sx={{ borderColor: "divider", borderTop: 1, py: 1.5, textAlign: "center" }}>
        <Typography color="text.secondary" variant="caption">
          LoadMaster © 2026 - Tutti i diritti riservati
        </Typography>
      </Box>
    </Box>
  );
}
