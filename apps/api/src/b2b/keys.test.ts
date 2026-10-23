import { describe, expect, test } from "bun:test";
import { generateApiKey, hashApiKey, looksLikeApiKey } from "./keys";

describe("claves de API", () => {
  test("la clave generada tiene la forma esperada y su hash es estable", () => {
    const { key, keyPrefix, keyHash } = generateApiKey();
    expect(looksLikeApiKey(key)).toBe(true);
    expect(key.startsWith(keyPrefix)).toBe(true);
    expect(keyHash).toBe(hashApiKey(key));
    expect(keyHash).toHaveLength(64);
    expect(keyHash).not.toContain(key);
  });
  test("dos claves nunca coinciden", () => {
    expect(generateApiKey().key).not.toBe(generateApiKey().key);
  });
  test("rechaza lo que no parece una clave", () => {
    for (const bad of ["", "abc", "Bearer x", "tp_live_corta", `tp_test_${"a".repeat(43)}`, `tp_live_${"a".repeat(44)}`]) {
      expect(looksLikeApiKey(bad)).toBe(false);
    }
  });
});
