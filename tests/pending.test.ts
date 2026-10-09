import { describe, expect, it } from "vitest";
import { openPending, sealPending, type PendingWork } from "@/server/pending";

const work: PendingWork = { kind: "rules", text: "supprime le sport", only: [{ kind: "event", id: "e1" }], opId: "op1" };

describe("pending confirmations", () => {
  it("round-trips for the same user", () => {
    expect(openPending("alice", sealPending("alice", work))).toEqual({ work });
  });

  it("refuses another user, a tampered token and an expired one", () => {
    const token = sealPending("alice", work, 0);
    expect(openPending("bob", sealPending("alice", work))).toHaveProperty("error");
    const [body, sig] = sealPending("alice", work).split(".");
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), u: "bob" })).toString("base64url");
    expect(openPending("bob", `${forged}.${sig}`)).toHaveProperty("error");
    expect(openPending("alice", token, 11 * 60 * 1000)).toEqual({ error: expect.stringMatching(/expiré/) });
    expect(openPending("alice", "garbage")).toHaveProperty("error");
  });
});
