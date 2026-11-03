"use client";

import { useState } from "react";
import { copyText, errorMessage } from "@/lib/client/api";
import { toast } from "./toast";
import { Button } from "./ui";

export function CopyButton({ text, label = "복사", disabled }: { text: string; label?: string; disabled?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function onCopy() {
    try {
      await copyText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      toast.error(`복사하지 못했어요: ${errorMessage(error)}`);
    }
  }
  return (
    <Button size="sm" variant={copied ? "primary" : "secondary"} onClick={onCopy} disabled={disabled || !text}>
      {copied ? "복사됨 ✓" : label}
    </Button>
  );
}
