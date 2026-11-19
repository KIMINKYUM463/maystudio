import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { proxy } from "@/proxy";

const req = (url: string, headers: Record<string, string> = {}, method = "GET") =>
  new NextRequest(url, { method, headers: new Headers(headers) });
const basic = (pw: string) => ({ authorization: `Basic ${Buffer.from(`me:${pw}`, "utf8").toString("base64")}` });

describe("password lock", () => {
  afterEach(() => {
    delete process.env.MAYSTUDIO_PASSWORD;
  });

  it("is off without a password set", () => {
    expect(proxy(req("https://www.mayaistudio.com/")).status).toBe(200);
  });

  it("asks visitors from the domain, lets the right password in, keeps followers' pages public", () => {
    process.env.MAYSTUDIO_PASSWORD = "비밀1234";
    const tunnel = { host: "www.mayaistudio.com", "cf-connecting-ip": "1.2.3.4" };
    expect(proxy(req("https://www.mayaistudio.com/", tunnel)).status).toBe(401);
    expect(proxy(req("https://www.mayaistudio.com/api/settings", { ...tunnel, ...basic("wrong") })).status).toBe(401);
    expect(proxy(req("https://www.mayaistudio.com/api/settings", { ...tunnel, ...basic("비밀1234") })).status).toBe(200);
    expect(proxy(req("https://www.mayaistudio.com/links", tunnel)).status).toBe(200);
    expect(proxy(req("https://www.mayaistudio.com/go/abc", tunnel)).status).toBe(200);
    // Writes are never public, even on public paths.
    expect(proxy(req("https://www.mayaistudio.com/api/files/projects/x/a.jpg", tunnel, "POST")).status).toBe(401);
  });

  it("never asks on this computer, but a spoofed localhost through the tunnel still must log in", () => {
    process.env.MAYSTUDIO_PASSWORD = "pw";
    expect(proxy(req("http://localhost:3000/", { host: "localhost:3000" })).status).toBe(200);
    expect(proxy(req("http://localhost:3000/", { host: "localhost:3000", "cf-connecting-ip": "1.2.3.4" })).status).toBe(401);
  });
});
