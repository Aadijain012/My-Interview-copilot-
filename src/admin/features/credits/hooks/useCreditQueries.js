import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchCredits, exportCredits } from "../api/creditsApi";

export const creditKeys = {
  all: ["credits"],
  lists: () => [...creditKeys.all, "list"],
  list: (params) => [...creditKeys.lists(), params],
};

export function useCredits(params) {
  return useQuery({
    queryKey: creditKeys.list(params),
    queryFn: () => fetchCredits(params),
  });
}

export function useExportCredits() {
  return useMutation({
    mutationFn: (params) => exportCredits(params),
    onSuccess: (csvText) => {
      const text = typeof csvText === "string" ? csvText : String(csvText);
      const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "credits-export.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  });
}
