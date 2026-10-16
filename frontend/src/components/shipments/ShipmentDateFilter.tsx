import { useState } from "react";
import { DatePicker } from "@mui/x-date-pickers";
import { itIT } from "@mui/x-date-pickers/locales";
import dayjs from "dayjs";

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export default function ShipmentDateFilter({ label, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  return <DatePicker
    label={label}
    value={value ? dayjs(value) : null}
    format="DD/MM/YYYY"
    localeText={itIT.components.MuiLocalizationProvider.defaultProps.localeText}
    timezone="system"
    closeOnSelect
    open={open}
    onOpen={() => setOpen(true)}
    onClose={() => setOpen(false)}
    onChange={date => {
      // Keep the existing date-only filter contract; never convert through UTC.
      if (date === null) onChange("");
      else if (date.isValid()) onChange(date.format("YYYY-MM-DD"));
    }}
    slotProps={{
      field: {
        clearable: true,
        onClear: event => { event.stopPropagation(); setOpen(false); },
      },
      clearButton: { "aria-label": `Cancella ${label}`, title: `Cancella ${label}` },
      textField: {
        size: "small",
        fullWidth: true,
        onClick: () => setOpen(true),
        sx: { minWidth: 0, cursor: "pointer" },
      },
    }}
  />;
}
