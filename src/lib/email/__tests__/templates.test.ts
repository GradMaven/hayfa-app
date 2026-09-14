import { describe, expect, it } from "vitest";
import { passwordResetEmail, passwordChangedEmail, notificationEmail } from "../templates";

describe("passwordResetEmail", () => {
  it("includes the reset URL in both html and text bodies", () => {
    const url = "https://hafya.example/reset-password?token=abc123";
    const { html, text } = passwordResetEmail({ name: "Amina Otieno", resetUrl: url });
    expect(html).toContain(url);
    expect(text).toContain(url);
  });

  it("greets the recipient by name", () => {
    const { html, text } = passwordResetEmail({ name: "Amina Otieno", resetUrl: "https://x" });
    expect(html).toContain("Amina Otieno");
    expect(text).toContain("Amina Otieno");
  });

  it("escapes HTML in the name to prevent injection into the email body", () => {
    const { html } = passwordResetEmail({ name: "<script>alert(1)</script>", resetUrl: "https://x" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("states the link expiry so recipients know it's time-limited", () => {
    const { text } = passwordResetEmail({ name: "Amina", resetUrl: "https://x" });
    expect(text.toLowerCase()).toContain("1 hour");
  });

  it("reassures a recipient who didn't request this that nothing happens automatically", () => {
    const { text } = passwordResetEmail({ name: "Amina", resetUrl: "https://x" });
    expect(text.toLowerCase()).toContain("didn't request");
  });
});

describe("passwordChangedEmail", () => {
  it("mentions that other sessions were signed out", () => {
    const { text } = passwordChangedEmail({ name: "Amina" });
    expect(text.toLowerCase()).toContain("signed out");
  });
});

describe("notificationEmail", () => {
  it("carries only the title/body it was given — no extra clinical detail is added", () => {
    const { text, subject } = notificationEmail({ name: "Amina", title: "Appointment scheduled", body: "Hypertension follow-up on Oct 12." });
    expect(subject).toBe("Appointment scheduled");
    expect(text).toContain("Hypertension follow-up on Oct 12.");
  });

  it("escapes HTML in title and body", () => {
    const { html } = notificationEmail({ name: "Amina", title: "<b>x</b>", body: "<img src=x onerror=alert(1)>" });
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<b>x</b>");
  });
});
