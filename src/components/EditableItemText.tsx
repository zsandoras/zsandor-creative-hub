import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface EditableItemTextProps {
  table: string;
  itemId: string;
  field: string;
  value: string | null;
  className?: string;
  as?: "h1" | "h2" | "h3" | "p" | "span";
  queryKey?: string[];
}

export const EditableItemText = ({
  table,
  itemId,
  field,
  value,
  className,
  as: Component = "p",
  queryKey,
}: EditableItemTextProps) => {
  const { isAdmin, isEditMode } = useAuth();
  const [content, setContent] = useState(value || "");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    setContent(value || "");
  }, [value]);

  const handleClick = (e: React.MouseEvent) => {
    if (isAdmin && isEditMode) {
      e.preventDefault();
      e.stopPropagation();
      if (!isEditing) {
        setIsEditing(true);
        setTimeout(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        }, 0);
      }
    }
  };

  const handleBlur = async () => {
    setIsEditing(false);
    if (content !== (value || "")) {
      await saveContent();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      inputRef.current?.blur();
    } else if (e.key === "Escape") {
      setContent(value || "");
      setIsEditing(false);
    }
  };

  const saveContent = async () => {
    setIsSaving(true);
    try {
      const updateData: Record<string, any> = {};
      updateData[field] = content || null;
      
      const { error } = await supabase
        .from(table as any)
        .update(updateData)
        .eq("id", itemId);

      if (error) throw error;

      // Invalidate relevant queries
      if (queryKey) {
        queryClient.invalidateQueries({ queryKey });
      }

      toast({
        title: "Content saved",
        description: "Your changes have been saved successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error saving content",
        description: error.message,
        variant: "destructive",
      });
      setContent(value || "");
    } finally {
      setIsSaving(false);
    }
  };

  const isClickable = isAdmin && isEditMode;

  // Always show editable field in edit mode even if no value
  if (!value && isClickable) {
    return (
      <Component
        onClick={handleClick}
        className={cn(
          className,
          "cursor-pointer bg-primary/10 border-2 border-dashed border-primary/50 rounded px-2 py-1 transition-all hover:bg-primary/20 hover:border-primary",
          isSaving && "opacity-50"
        )}
        title="Click to add content"
      >
        {field === "title" ? "Click to add title" : "Click to add description"}
      </Component>
    );
  }

  if (isEditing) {
    const isMultiline = Component === "p";
    const InputComponent = isMultiline ? "textarea" : "input";
    
    return (
      <InputComponent
        ref={inputRef as any}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={cn(
          "w-full bg-primary/10 border-2 border-primary rounded px-2 py-1 focus:outline-none",
          className
        )}
        rows={isMultiline ? 3 : undefined}
        placeholder={field === "title" ? "Enter title" : "Enter description"}
      />
    );
  }

  return (
    <Component
      onClick={handleClick}
      className={cn(
        className,
        isClickable && "cursor-pointer hover:bg-primary/10 hover:outline hover:outline-2 hover:outline-primary/50 rounded px-2 py-1 transition-all",
        isSaving && "opacity-50"
      )}
      title={isClickable ? "Click to edit" : undefined}
    >
      {content || "No content"}
    </Component>
  );
};
