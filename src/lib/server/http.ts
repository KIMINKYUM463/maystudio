import { ZodError } from "zod";
import { AssetError } from "./assets";
import { NotFoundError } from "./store";

export class BadRequestError extends Error {}

export function errorResponse(error: unknown): Response {
  if (error instanceof NotFoundError) return Response.json({ error: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    return Response.json({ error: `입력값 오류: ${issue?.path.join(".")} ${issue?.message}` }, { status: 400 });
  }
  if (error instanceof AssetError || error instanceof BadRequestError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  console.error(error);
  const message = error instanceof Error ? error.message : "알 수 없는 오류";
  return Response.json({ error: message }, { status: 500 });
}

/** Wraps a route handler so thrown errors become JSON responses. */
export function route<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new BadRequestError("JSON 본문이 올바르지 않습니다.");
  }
}
