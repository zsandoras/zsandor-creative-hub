import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Trash2, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import { z } from "zod";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const commentSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Comment cannot be empty")
    .max(1000, "Comment must be less than 1000 characters"),
});

interface CommentSectionProps {
  contentType: "music_track" | "food_item" | "guitar_embed";
  contentId: string;
  className?: string;
}

interface Comment {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
}

export function CommentSection({ contentType, contentId, className }: CommentSectionProps) {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["comments", contentType, contentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("*")
        .eq("content_type", contentType)
        .eq("content_id", contentId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Comment[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (validatedMessage: string) => {
      if (!user) throw new Error("Must be logged in");
      
      const { error } = await supabase.from("comments").insert({
        user_id: user.id,
        content_type: contentType,
        content_id: contentId,
        message: validatedMessage,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Comment added!" });
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["comments", contentType, contentId] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase.from("comments").delete().eq("id", commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Comment deleted" });
      queryClient.invalidateQueries({ queryKey: ["comments", contentType, contentId] });
    },
  });

  const handleSubmit = () => {
    const result = commentSchema.safeParse({ message });
    if (!result.success) {
      toast({
        title: "Validation Error",
        description: result.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(result.data.message);
  };

  const commentCount = comments.length;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full flex items-center justify-between gap-2 text-muted-foreground hover:text-foreground">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="text-sm font-medium">
              {commentCount} {commentCount === 1 ? "Comment" : "Comments"}
            </span>
          </div>
          <span className="text-xs">{isOpen ? "Hide" : "Show"}</span>
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-4 mt-4">
        {user ? (
          <Card className="p-4 bg-card/50 backdrop-blur">
            <Textarea
              placeholder="Add a comment..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="mb-2 resize-none"
              maxLength={1000}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {message.length}/1000 characters
              </span>
              <Button
                onClick={handleSubmit}
                disabled={!message.trim() || createMutation.isPending}
                size="sm"
              >
                {createMutation.isPending ? "Posting..." : "Post Comment"}
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="p-4 text-center bg-card/50 backdrop-blur">
            <p className="text-sm text-muted-foreground mb-2">
              Sign in to leave a comment
            </p>
            <Link to="/auth">
              <Button size="sm" variant="outline">
                Sign In
              </Button>
            </Link>
          </Card>
        )}

        <div className="space-y-3">
          {isLoading ? (
            <Card className="p-4 bg-card/50 backdrop-blur">
              <p className="text-sm text-muted-foreground text-center">Loading comments...</p>
            </Card>
          ) : comments.length === 0 ? (
            <Card className="p-4 bg-card/50 backdrop-blur">
              <p className="text-sm text-muted-foreground text-center">
                No comments yet. Be the first to comment!
              </p>
            </Card>
          ) : (
            comments.map((comment) => (
              <Card key={comment.id} className="p-4 bg-card/50 backdrop-blur">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    <p className="text-sm break-words">{comment.message}</p>
                  </div>

                  {(user?.id === comment.user_id || isAdmin) && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(comment.id)}
                      disabled={deleteMutation.isPending}
                      className="shrink-0"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}