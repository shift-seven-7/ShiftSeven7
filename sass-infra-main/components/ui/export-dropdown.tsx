'use client';

import { Download, FileDown, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface ExportDropdownProps {
  onExportExcel?: () => void;
  onExportPdf?: () => void;
  disabled?: boolean;
  /** Label shown on desktop next to icon */
  label?: string;
  /** Button variant */
  variant?: 'outline' | 'ghost';
  /** Responsive icon-only on mobile (default: true) */
  iconOnlyMobile?: boolean;
  /** Additional className for the trigger button */
  className?: string;
  /** Size preset */
  size?: 'sm' | 'default' | 'icon';
}

export function ExportDropdown({
  onExportExcel,
  onExportPdf,
  disabled = false,
  label = 'ייצוא',
  variant = 'outline',
  iconOnlyMobile = true,
  className,
  size = 'sm',
}: ExportDropdownProps) {
  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          disabled={disabled}
          className={cn(
            'gap-1.5',
            iconOnlyMobile && size !== 'icon' && 'h-8 w-8 p-0 md:h-9 md:w-auto md:px-3 text-xs font-medium rounded-lg md:gap-1.5',
            !iconOnlyMobile && size === 'sm' && 'min-h-[36px]',
            className
          )}
        >
          <Download className="h-4 w-4 shrink-0" />
          {size === 'icon' ? null : iconOnlyMobile ? (
            <span className="hidden md:inline">{label}</span>
          ) : (
            <>
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">ייצוא</span>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        {onExportPdf && (
          <DropdownMenuItem onClick={onExportPdf} className="gap-2 cursor-pointer">
            <FileDown className="h-4 w-4" />
            ייצוא PDF
          </DropdownMenuItem>
        )}
        {onExportExcel && (
          <DropdownMenuItem onClick={onExportExcel} className="gap-2 cursor-pointer">
            <FileSpreadsheet className="h-4 w-4" />
            ייצוא Excel
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
