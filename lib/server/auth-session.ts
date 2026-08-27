import { getAuthSession as readDeviceSession } from "@/auth";

export async function getAuthSession(headers: Headers) {
  return readDeviceSession(headers);
}
