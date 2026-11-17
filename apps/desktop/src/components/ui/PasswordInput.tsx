import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input, type InputProps } from "./Input";

export type PasswordInputProps = Omit<InputProps, "type" | "trailing">;

export function PasswordInput({ autoComplete, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <Input
      {...props}
      type={visible ? "text" : "password"}
      autoComplete={autoComplete ?? "new-password"}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          title={visible ? "Hide password" : "Show password"}
          className="-mr-1 grid size-6 place-items-center rounded text-ink-muted transition-colors duration-100 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {visible ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      }
    />
  );
}
