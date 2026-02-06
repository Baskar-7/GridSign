import React from "react";
import { PanelHeader } from './PanelHeader'; // ensured module exists in same folder
import { Type, Calendar, PenTool, CheckSquare, ScanText, Image as ImageIcon, Radio, Trash2, X, Copy, Check, AlertCircle } from "lucide-react";
import { actionBtn } from "./actionButtonStyles";

interface FieldTypeMeta { type: string; label: string; icon: React.ComponentType<any> }
const fieldTypeMeta: FieldTypeMeta[] = [
  { type: "text", label: "Text Input", icon: Type },
  { type: "date", label: "Date Picker", icon: Calendar },
  { type: "signature", label: "Signature", icon: PenTool },
  { type: "checkbox", label: "Checkbox", icon: CheckSquare },
  { type: "initials", label: "Initials", icon: ScanText },
  { type: "image", label: "Image Upload", icon: ImageIcon },
  { type: "radio", label: "Radio Button", icon: Radio },
  // Newly requested identity/contact oriented fields
  { type: "name", label: "Name", icon: Type },
  { type: "fullname", label: "Full Name", icon: Type },
  { type: "email", label: "Email", icon: Type },
  { type: "mobile", label: "Mobile", icon: Type },
];
interface FieldToolbarProps {
  pendingFieldType?: string | null;
  setPendingFieldType: (type: string | null) => void;
  onClose?: () => void;
  selectedField: {
    id: string;
    fieldType: string;
    fieldName: string;
    isRequired: boolean;
    width: number;
    height: number;
    page: number;
    recipientId: string;
  } | null;
  fieldTypes: string[]; // simple list of types
  recipientOptions: { id: string; name: string }[];
  numPages?: number;
  onChangeFieldType: (type: string) => void;
  onChangeRecipient: (recipientId: string) => void;
  onChangePage: (page: number) => void;
  onChangeSize: (width: number, height: number) => void;
  onToggleRequired: () => void;
  onDuplicateField: () => void;
  onRemoveField: () => void;
  onDonePlacement: () => void;
}
export const FieldToolbar: React.FC<FieldToolbarProps> = ({
  pendingFieldType,
  setPendingFieldType,
  onClose,
  selectedField,
  fieldTypes,
  recipientOptions,
  numPages = 0,
  onChangeFieldType,
  onChangeRecipient,
  onChangePage,
  onChangeSize,
  onToggleRequired,
  onDuplicateField,
  onRemoveField,
  onDonePlacement,
}) => (
  <div className="flex-1 bg-card p-4 overflow-y-auto">
    <PanelHeader title="Field Tools" onClose={onClose} />
    <div>
      <p className="text-[11px] text-muted-foreground mb-3">Select a field type, then click on the document to place it.</p>
      <div className="grid grid-cols-2 gap-3">
        {fieldTypeMeta.map(ft => {
          const active = pendingFieldType === ft.type;
          const Icon = ft.icon;
          return (
            <button
              key={ft.type}
              className={`group relative flex items-center gap-2 p-2 rounded-lg border text-left text-xs font-medium focus:outline-none transition-colors duration-200 ${active ? 'border-primary/80 bg-gradient-to-r from-primary/15 to-primary/5 shadow-inner' : 'border-border bg-muted/60 hover:bg-muted/80 hover:border-primary/40'}`}
              title={`Add ${ft.label}`}
              onClick={() => setPendingFieldType(active ? null : ft.type)}
            >
              <Icon className={`h-4 w-4 ${active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'} transition-colors`} />
              <span className="truncate">{ft.label}</span>
              {active && <span className="absolute inset-x-0 -bottom-px h-px bg-primary/50" />}
            </button>
          );
        })}
      </div>
      {pendingFieldType && !selectedField && (
        <div className="mt-4 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Placing: <strong>{pendingFieldType}</strong></span>
          <button
            type="button"
            className="px-2 py-1 rounded border border-border text-muted-foreground hover:bg-muted/50"
            onClick={() => setPendingFieldType(null)}
          >Cancel</button>
        </div>
      )}
    </div>
    {selectedField && (
      <div className="space-y-3 mt-6 border-t border-border/40 pt-4 animate-in fade-in">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold flex items-center gap-1"><PenTool className="w-3 h-3 text-muted-foreground" /> Editing Field</span>
          <button
            type="button"
            onClick={onDonePlacement}
            className={actionBtn('success','text-[11px]')}
            title="Finish Editing"
            aria-label="Finish Editing"
          >
            <Check className="w-3 h-3" />
            <span className="hidden sm:inline">Done</span>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[10px]">
            <span className="uppercase tracking-wide text-muted-foreground">Type</span>
            <select
              className="text-xs border border-border rounded px-2 py-1 bg-background"
              value={selectedField.fieldType}
              onChange={(e) => onChangeFieldType(e.target.value)}
            >
              {fieldTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[10px]">
            <span className="uppercase tracking-wide text-muted-foreground">Recipient</span>
            <select
              className="text-xs border border-border rounded px-2 py-1 bg-background"
              value={selectedField.recipientId}
              onChange={(e) => onChangeRecipient(e.target.value)}
            >
              {recipientOptions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
        </div>
        {numPages > 1 && (
          <label className="flex flex-col gap-1 text-[10px]">
            <span className="uppercase tracking-wide text-muted-foreground">Page</span>
            <select
              className="text-xs border border-border rounded px-2 py-1 bg-background w-full"
              value={selectedField.page}
              onChange={(e) => onChangePage(parseInt(e.target.value, 10))}
            >
              {Array.from({ length: numPages }, (_, i) => i + 1).map(p => <option key={p} value={p}>Page {p}</option>)}
            </select>
          </label>
        )}
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[10px]">
            <span className="uppercase tracking-wide text-muted-foreground">Width</span>
            <input
              type="number"
              min={20}
              className="text-xs border border-border rounded px-2 py-1 bg-background"
              value={Math.round(selectedField.width)}
              onChange={(e) => onChangeSize(parseInt(e.target.value,10) || selectedField.width, selectedField.height)}
            />
          </label>
          <label className="flex flex-col gap-1 text-[10px]">
            <span className="uppercase tracking-wide text-muted-foreground">Height</span>
            <input
              type="number"
              min={20}
              className="text-xs border border-border rounded px-2 py-1 bg-background"
              value={Math.round(selectedField.height)}
              onChange={(e) => onChangeSize(selectedField.width, parseInt(e.target.value,10) || selectedField.height)}
            />
          </label>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onToggleRequired}
            aria-pressed={selectedField.isRequired}
            className={actionBtn(selectedField.isRequired ? 'requiredActive' : 'requiredInactive','text-xs')}
            title={selectedField.isRequired ? 'Mark Optional' : 'Mark Required'}
            aria-label={selectedField.isRequired ? 'Required Field (toggle to optional)' : 'Optional Field (toggle to required)'}
          >
            {selectedField.isRequired ? <AlertCircle className="w-3 h-3" /> : <CheckSquare className="w-3 h-3 opacity-70" />}
            <span className="hidden sm:inline">{selectedField.isRequired ? 'Required' : 'Optional'}</span>
          </button>
          <button
            type="button"
            onClick={onDuplicateField}
            className={actionBtn('muted')}
            title="Duplicate Field"
            aria-label="Duplicate Field"
          >
            <Copy className="w-3 h-3" />
            <span className="hidden sm:inline">Duplicate</span>
          </button>
          <button
            type="button"
            onClick={onRemoveField}
            className={actionBtn('destructive')}
            title="Remove Field"
            aria-label="Remove Field"
          >
            <Trash2 className="w-3 h-3" />
            <span className="hidden sm:inline">Remove</span>
          </button>
        </div>
      </div>
    )}
  </div>
);
