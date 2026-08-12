import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Button } from "@mui/material";

interface Props {
  onBack: () => void;
}

export default function MobileDashboardReturn({ onBack }: Props) {
  return (
    <Button
      className="no-print"
      fullWidth
      size="large"
      variant="outlined"
      startIcon={<ArrowBackIcon />}
      onClick={onBack}
      sx={{ display: { xs: "flex", sm: "none" }, minHeight: 52, mt: 2.5 }}
    >
      Dashboard
    </Button>
  );
}
