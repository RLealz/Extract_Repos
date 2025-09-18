import * as React from "react";
import { cn } from "@/app/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  state?: "default" | "error" | "success" | "disabled";
}

export default function Input({ className, state = "default", ...props }: InputProps) {
  // Ensure readable text color regardless of global theme (input uses white background)
  const base = "flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50";
  const stateCls: Record<NonNullable<InputProps["state"]>, string> = {
    default: "border-gray-300 focus:border-blue-500",
    error: "border-red-500 focus-visible:ring-red-500",
    success: "border-green-500 focus-visible:ring-green-500",
    disabled: "opacity-50",
  };
  return (
    <input className={cn(base, stateCls[state], className)} {...props} />
  );
}