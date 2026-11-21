import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// A form's width (42rem, start-aligned) inside the wider page: a long line between label and field is hard to read.
type FormContainerProps = ({ asForm: true } & ComponentProps<"form">) | ({ asForm?: false } & ComponentProps<"div">);

export function FormContainer({ asForm, className, ...props }: FormContainerProps) {
  const width = cn("w-full max-w-2xl", className);
  return asForm ? (
    <form className={width} {...(props as ComponentProps<"form">)} />
  ) : (
    <div className={width} {...(props as ComponentProps<"div">)} />
  );
}
