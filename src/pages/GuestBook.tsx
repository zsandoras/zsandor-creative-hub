import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";

export default function GuestBook() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  const { data: messages = [] } = useQuery({
    queryKey: ["guest-book", isAdmin],
    queryFn: async () => {
      let query = supabase
        .from("guest_book")
        .select("*")
        .order("created_at", { ascending: false });

      if (!isAdmin) {
        query = query.eq("approved", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Must be logged in to post");
      
      const { error } = await supabase.from("guest_book").insert({
        name,
        message,
        user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Message submitted for approval!" });
      setName("");
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["guest-book"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("guest_book").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Message deleted" });
      queryClient.invalidateQueries({ queryKey: ["guest-book"] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const { error } = await supabase
        .from("guest_book")
        .update({ approved })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guest-book"] });
    },
  });

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Guest Book</h1>

        {user ? (
          <Card className="p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Leave a Message</h2>
            <div className="space-y-4">
              <Input
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Textarea
                placeholder="Your message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
              />
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!name || !message || createMutation.isPending}
              >
                Submit
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="p-6 mb-8 text-center bg-card/50 backdrop-blur">
            <h2 className="text-xl font-semibold mb-2">Leave a Message</h2>
            <p className="text-muted-foreground mb-4">
              Sign in to leave a message in the guest book
            </p>
            <Link to="/auth">
              <Button>Sign In</Button>
            </Link>
          </Card>
        )}

        <div className="space-y-4">
          {messages.map((msg: any) => (
            <Card
              key={msg.id}
              className={`p-6 ${!msg.approved && isAdmin ? "border-yellow-500" : ""}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold">{msg.name}</h3>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                    </span>
                    {!msg.approved && isAdmin && (
                      <span className="text-xs bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded">
                        Pending
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground">{msg.message}</p>
                </div>

                {isAdmin && (
                  <div className="flex gap-2">
                    {!msg.approved && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          approveMutation.mutate({ id: msg.id, approved: true })
                        }
                      >
                        <Check className="h-4 w-4 text-green-500" />
                      </Button>
                    )}
                    {msg.approved && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          approveMutation.mutate({ id: msg.id, approved: false })
                        }
                      >
                        <X className="h-4 w-4 text-yellow-500" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(msg.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
