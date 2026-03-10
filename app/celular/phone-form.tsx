"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { PhoneOtpInput } from "@/components/ui/phone-otp-input";
import { identifyMemberByPhone } from "@/server/member/identifyMember";

const PHONE_LENGTH = 11; // 55 (BR) + DDD (2) + 8 digits

export function PhoneForm() {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { update: updateSession } = useSession();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);

    const result = await identifyMemberByPhone(phone);

    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    await updateSession({ member: result.member });
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 flex flex-col items-center">
      <div className="space-y-2">
        <PhoneOtpInput
          value={phone}
          onChange={setPhone}
          length={PHONE_LENGTH}
          disabled={loading}
          placeholder="11999999999"
          aria-label="Número de celular com DDD"
        />
        <input type="hidden" name="phone" value={phone} readOnly aria-hidden />
        {fieldErrors.phone?.[0] && (
          <p className="text-sm text-destructive">{fieldErrors.phone[0]}</p>
        )}
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button
        type="submit"
        className="w-50 mx-auto"
        size="lg"
        disabled={loading || phone.length < 10}
      >
        {loading ? "Verificando…" : "Continuar"}
      </Button>
    </form>
  );
}
