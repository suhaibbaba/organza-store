import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// The one width a FORM is allowed to be, inside PageContainer's much wider one.
//
// PageContainer caps a page at 1440px because this app's tables are wide. A
// form is the opposite shape: a single column of labelled fields, read top to
// bottom. Left at the page's width, a name box and a Save button run the whole
// span of a laptop — the eye travels the width of the screen to get from a
// label to the field it names, and the submit becomes a metre-wide bar. 42rem
// is a comfortable line to read and a comfortable field to fill in.
//
// Start-aligned rather than centred, so the fields line up under the page's
// own title instead of drifting into the middle of the screen away from it.
//
// On a phone this is nothing at all: the cap sits far above the viewport, so
// the form is exactly the full-width single column it has always been.
//
// `asForm` renders the <form> itself rather than a wrapper around it — a form
// is already a flex column, and a div whose only job is a max-width is one DOM
// node and one layout context more than the layout needs.
type FormContainerProps =
  | ({ asForm: true } & ComponentProps<"form">)
  | ({ asForm?: false } & ComponentProps<"div">);

export function FormContainer({ asForm, className, ...props }: FormContainerProps) {
  const width = cn("w-full max-w-2xl", className);
  return asForm ? (
    <form className={width} {...(props as ComponentProps<"form">)} />
  ) : (
    <div className={width} {...(props as ComponentProps<"div">)} />
  );
}
