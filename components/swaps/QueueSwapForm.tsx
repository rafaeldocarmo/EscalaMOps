"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { getMembersForQueueSwap } from "@/server/swaps/getMembersForQueueSwap";
import { createQueueSwapRequest } from "@/server/swaps/createQueueSwapRequest";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface QueueSwapFormProps {
  memberId: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Enviando…" : "Solicitar troca de fila"}
    </Button>
  );
}

export function QueueSwapForm({ memberId }: QueueSwapFormProps) {
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [targetId, setTargetId] = useState<string>("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    getMembersForQueueSwap().then(setMembers);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!targetId) {
      setMessage({ type: "error", text: "Selecione um membro para trocar a posição na fila." });
      return;
    }
    const result = await createQueueSwapRequest(targetId);
    if (result.success) {
      setMessage({
        type: "success",
        text: "Solicitação enviada. O outro membro precisa aceitar e, em seguida, um administrador aprovará.",
      });
      setTargetId("");
    } else {
      setMessage({ type: "error", text: result.error });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Trocar posição na fila de fim de semana</CardTitle>
        <p className="text-sm text-muted-foreground">
          Escolha um colega do mesmo nível e turno. Após ele aceitar, um administrador aprovará a troca.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Trocar com</Label>
            <Select value={targetId} onValueChange={setTargetId} required>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o membro" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
                {members.length === 0 && (
                  <SelectItem value="__none" disabled>
                    Nenhum colega do mesmo nível/turno
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          {message && (
            <p
              className={`text-sm ${message.type === "success" ? "text-green-600" : "text-destructive"}`}
            >
              {message.text}
            </p>
          )}
          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}
