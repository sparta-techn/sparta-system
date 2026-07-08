import { Download, FileSpreadsheet, FileText, Printer, Table2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ExportMenu({ scope }: { scope: string }) {
  const fire = (format: string) =>
    toast.success(`Preparing ${format} export`, {
      description: `${scope} analytics will be ready momentarily. This is a UI placeholder.`,
    });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="mr-2 size-4" aria-hidden />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Download</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => fire("PDF")}>
          <FileText className="mr-2 size-4" aria-hidden /> PDF report
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => fire("Excel")}>
          <FileSpreadsheet className="mr-2 size-4" aria-hidden /> Excel workbook
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => fire("CSV")}>
          <Table2 className="mr-2 size-4" aria-hidden /> CSV data
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            window.print();
          }}
        >
          <Printer className="mr-2 size-4" aria-hidden /> Print view
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
