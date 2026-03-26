import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { ApiError } from "@/lib/server/api-error";

export async function readJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details ?? null,
        },
      },
      { status: error.status },
    );
  }

  if (error instanceof Error && error.message === "PASSKEY_CEREMONY_MISSING") {
    return NextResponse.json(
      {
        error: {
          code: "PASSKEY_CEREMONY_MISSING",
          message: "The passkey ceremony state is missing or expired.",
        },
      },
      { status: 400 },
    );
  }

  if (error instanceof Error && error.message === "MEDIA_FILE_MISSING") {
    return NextResponse.json(
      {
        error: {
          code: "MEDIA_FILE_MISSING",
          message: "An image file is required for this upload.",
        },
      },
      { status: 400 },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed.",
          details: error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  console.error(error);

  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      },
    },
    { status: 500 },
  );
}
