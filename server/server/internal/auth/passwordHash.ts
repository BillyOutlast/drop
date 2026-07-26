import bcrypt from "bcryptjs";
import * as argon2 from "argon2";

/**
 * Verifies a password against a bcrypt hash.
 *
 * @param password - The plaintext password to verify.
 * @param hash - The bcrypt hash to compare against.
 * @returns Whether the password matches the hash.
 */
export async function checkHashBcrypt(password: string, hash: string) {
  return await bcrypt.compare(password, hash);
}

/**
 * Creates an Argon2id hash from a password.
 *
 * @param password - The plaintext password to hash.
 * @returns The Argon2id hash string.
 */
export async function createHashArgon2(password: string) {
  return await argon2.hash(password);
}

/**
 * Verifies a password against an Argon2id hash.
 *
 * @param password - The plaintext password to verify.
 * @param hash - The Argon2id hash to compare against.
 * @returns Whether the password matches the hash.
 */
export async function checkHashArgon2(password: string, hash: string) {
  return await argon2.verify(hash, password);
}
