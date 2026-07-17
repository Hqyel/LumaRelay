import { ApiError } from "../api.js";

export interface MediaErrorPresentation {
  description: string;
  retryable: boolean;
  title: string;
  type: "access-denied" | "not-found" | "offline";
}

function withRequestId(description: string, error: ApiError): string {
  return error.requestId === "unknown"
    ? description
    : `${description} 请求 ID：${error.requestId}`;
}

export function mediaErrorPresentation(
  error: unknown,
  subject: string,
): MediaErrorPresentation {
  if (
    error instanceof ApiError &&
    (error.code === "ACCESS_DENIED" || error.statusCode === 403)
  )
    return {
      description: withRequestId(
        `当前账户没有浏览${subject}的权限。请切换账户或联系服务器管理员。`,
        error,
      ),
      retryable: false,
      title: `无权访问${subject}`,
      type: "access-denied",
    };

  if (
    error instanceof ApiError &&
    (error.code === "MEDIA_NOT_FOUND" || error.statusCode === 404)
  )
    return {
      description: withRequestId(
        `${subject}可能已被移动、删除，或不再向当前账户开放。`,
        error,
      ),
      retryable: false,
      title: `${subject}不存在`,
      type: "not-found",
    };

  const description =
    error instanceof ApiError && error.statusCode === 0
      ? `无法连接 NewEmby Gateway，暂时不能读取${subject}。`
      : `无法从媒体服务器读取${subject}，请检查连接后重试。`;

  return {
    description:
      error instanceof ApiError
        ? withRequestId(description, error)
        : description,
    retryable: true,
    title: `${subject}暂时不可用`,
    type: "offline",
  };
}
