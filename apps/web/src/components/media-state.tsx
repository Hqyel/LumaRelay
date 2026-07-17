import { Button, ErrorState } from "@newemby/ui";
import { ShieldAlert } from "lucide-react";

import { mediaErrorPresentation } from "./media-state-model.js";

export function MediaErrorState({
  error,
  onRetry,
  subject,
}: {
  error: unknown;
  onRetry?: () => void;
  subject: string;
}) {
  const presentation = mediaErrorPresentation(error, subject);

  return (
    <ErrorState
      action={
        presentation.retryable && onRetry !== undefined ? (
          <Button onClick={onRetry}>重新加载</Button>
        ) : undefined
      }
      description={presentation.description}
      icon={
        presentation.type === "access-denied" ? (
          <ShieldAlert size={24} />
        ) : undefined
      }
      title={presentation.title}
    />
  );
}

export function MediaAccessDeniedState({ subject }: { subject: string }) {
  return (
    <ErrorState
      description={`当前账户没有浏览${subject}的权限。请返回已授权的媒体库。`}
      icon={<ShieldAlert size={24} />}
      title={`无权访问${subject}`}
    />
  );
}
