import React, { useRef } from "react";
import { Rnd } from "react-rnd";
import { Field } from "./DocumentFieldMapper";

export const DraggableField: React.FC<{
  field: Field;
  selected: boolean;
  onUpdate: (updates: Partial<Field>) => void;
  onSelect: () => void;
  onRemove: () => void;
  activeRecipientId: string;
  recipientColor?: string;
  dimmed?: boolean;
  snapToGrid?: boolean;
  gridSize?: number;
  readOnly?: boolean;
}> = ({ field, selected, onUpdate, onSelect, onRemove, activeRecipientId, recipientColor, dimmed = false, snapToGrid = true, gridSize = 8, readOnly = false }) => {
  const baseColor = recipientColor || '#6b7280';
  const isActiveRecipient = field.recipientId === activeRecipientId;
  // Uniform recipient-based styling: always show color border; selected gets thicker + glow
  const borderColor = baseColor;
  const background = selected
    ? `${baseColor}26` // ~15% opacity
    : `${baseColor}14`; // ~8% opacity for non-selected to keep visibility
  const boxShadow = selected
    ? `0 0 0 2px ${baseColor}, 0 0 0 4px rgba(0,0,0,0.05)`
    : isActiveRecipient
      ? `0 0 0 1px ${baseColor}`
      : '0 0 0 1px rgba(0,0,0,0.04)';

  const lastPointerOffset = useRef<{dx:number; dy:number} | null>(null);

  const handleDrag = (_: any, data: { x: number; y: number; deltaX: number; deltaY: number }) => {
    onUpdate({ x: data.x, y: data.y });
  };

  const handleDragStart = (e: any) => {
    const targetRect = (e.target as HTMLElement).getBoundingClientRect();
    lastPointerOffset.current = { dx: e.clientX - targetRect.left, dy: e.clientY - targetRect.top };
  };

  const rndRef = useRef<Rnd | null>(null);
  const getParent = (): HTMLElement | null => {
    const el = rndRef.current?.getSelfElement?.();
    return el?.parentElement || null;
  };

  return (
    <Rnd
      ref={r => { rndRef.current = r; }}
      size={{ width: field.width, height: field.height }}
      position={{ x: field.x, y: field.y }}
      onDragStart={handleDragStart}
      onDrag={readOnly ? undefined : handleDrag}
      onDragStop={readOnly ? undefined : ((e, d) => {
        const parent = getParent();
        if (parent) {
          const maxX = parent.offsetWidth - field.width;
          const maxY = parent.offsetHeight - field.height;
          let clampedX = Math.min(Math.max(0, d.x), maxX);
          let clampedY = Math.min(Math.max(0, d.y), maxY);
          if (snapToGrid) {
            const g = gridSize;
            clampedX = Math.round(clampedX / g) * g;
            clampedY = Math.round(clampedY / g) * g;
          }
          onUpdate({ x: clampedX, y: clampedY });
        } else {
          onUpdate({ x: d.x, y: d.y });
        }
      })}
      onResizeStop={readOnly ? undefined : ((e, dir, ref, delta, pos) => {
        const parent = getParent();
        let newW = ref.offsetWidth;
        let newH = ref.offsetHeight;
        let newX = pos.x;
        let newY = pos.y;
        if (parent) {
          newW = Math.min(newW, parent.offsetWidth - newX);
          newH = Math.min(newH, parent.offsetHeight - newY);
        }
        if (snapToGrid) {
          const g = gridSize;
          newW = Math.max(g, Math.round(newW / g) * g);
          newH = Math.max(g, Math.round(newH / g) * g);
          newX = Math.round(newX / g) * g;
          newY = Math.round(newY / g) * g;
        }
        onUpdate({
          width: newW,
          height: newH,
          x: newX,
          y: newY,
        });
      })}
      bounds="parent"
      enableResizing={!readOnly}
      dragHandleClassName="grid-field-handle"
      style={{
        border: selected ? `2px solid ${borderColor}` : `1.5px solid ${borderColor}`,
        background,
        boxShadow,
        zIndex: selected ? 10 : 1,
        cursor: readOnly ? 'default' : 'move',
        transition: 'box-shadow 120ms, border-color 120ms, background-color 120ms',
        pointerEvents: 'auto',
        borderRadius: 4,
        opacity: dimmed ? 0.25 : 1,
      }}
    >
      <div
        className="grid-field-handle flex items-center justify-between h-full px-2 select-none transition-opacity duration-150"
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
      >
        <span className="text-xs font-semibold truncate capitalize flex items-center gap-1" style={{ color: baseColor }} title={field.fieldName}>
          {field.fieldType}
          {field.isRequired && <span className="text-[10px] text-red-600" title="Required">*</span>}
        </span>
        {!readOnly && <button
          className="text-[10px] leading-none rounded px-1 py-0.5 ml-2 bg-destructive/10 text-destructive hover:bg-destructive/20 transition"
          onClick={e => { e.stopPropagation(); onRemove(); }}
          title="Remove Field"
        >✕</button>
        }
      </div>
    </Rnd>
  );
};
