import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EditableTextProps {
  pageKey: string;
  contentKey: string;
  defaultValue: string;
  className?: string;
  as?: "h1" | "h2" | "h3" | "p" | "span";
}

export const EditableText = ({
  pageKey,
  contentKey,
  defaultValue,
  className,
  as: Component = "p",
}: EditableTextProps) => {
  const { isAdmin, isEditMode } = useAuth();
  const [content, setContent] = useState(defaultValue);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadContent();
  }, [pageKey, contentKey]);

  const loadContent = async () => {
    try {
      const { data } = await supabase
        .from("page_content")
        .select("content")
        .eq("page_key", pageKey)
        .maybeSingle();

      if (data?.content && typeof data.content === 'object') {
        const savedContent = (data.content as any)[contentKey];
        if (savedContent) {
          setContent(savedContent);
        }
      }
    } catch (error) {
      console.error("Error loading content:", error);
    }
  };

  const handleClick = () => {
    if (isAdmin && isEditMode && !isEditing) {
      setIsEditing(true);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  };

  const handleBlur = async () => {
    setIsEditing(false);
    if (content !== defaultValue) {
      await saveContent();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      inputRef.current?.blur();
    } else if (e.key === "Escape") {
      setContent(defaultValue);
      setIsEditing(false);
    }
  };

  const saveContent = async () => {
    setIsSaving(true);
    try {
      // Get existing content
      const { data: existing } = await supabase
        .from("page_content")
        .select("*")
        .eq("page_key", pageKey)
        .maybeSingle();

      const existingContentObj = (existing?.content && typeof existing.content === 'object') 
        ? (existing.content as Record<string, any>) 
        : {};

      const updatedContent = {
        ...existingContentObj,
        [contentKey]: content,
      };

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from("page_content")
          .update({
            content: updatedContent,
            updated_at: new Date().toISOString(),
          })
          .eq("page_key", pageKey);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from("page_content")
          .insert({
            page_key: pageKey,
            content: updatedContent,
          });

        if (error) throw error;
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
      setContent(defaultValue);
    } finally {
      setIsSaving(false);
    }
  };

  const isClickable = isAdmin && isEditMode;

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
      {content}
    </Component>
  );
};
