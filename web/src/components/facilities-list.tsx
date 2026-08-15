"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

function useFacilities() {
  return useQuery({
    queryKey: ["facilities"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("facilities")
        .select("id, name, code, status")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

function useCreateFacility() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; code: string }) => {
      const supabase = createClient();
      const { error } = await supabase.from("facilities").insert(input);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["facilities"] });
    },
  });
}

export function FacilitiesList() {
  const { data: facilities, isLoading, error } = useFacilities();
  const createFacility = useCreateFacility();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    try {
      await createFacility.mutateAsync({ name, code });
      toast.success(`Created facility "${name}"`);
      setName("");
      setCode("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create facility");
    }
  }

  return (
    <div className="w-full max-w-md space-y-4">
      <h2 className="text-lg font-semibold">Facilities</h2>

      <form onSubmit={handleCreate} className="flex gap-2">
        <Input
          placeholder="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <Input
          placeholder="Code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          required
          className="max-w-24"
        />
        <Button type="submit" disabled={createFacility.isPending}>
          Add
        </Button>
      </form>

      {isLoading && <p className="text-muted-foreground text-sm">Loading...</p>}
      {error && <p className="text-destructive text-sm">{error.message}</p>}

      {facilities && facilities.length === 0 && (
        <p className="text-muted-foreground text-sm">No facilities yet.</p>
      )}

      <ul className="space-y-1">
        {facilities?.map((facility) => (
          <li
            key={facility.id}
            className="flex items-center justify-between rounded border px-3 py-2 text-sm"
          >
            <span>{facility.name}</span>
            <span className="text-muted-foreground font-mono text-xs">{facility.code}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
